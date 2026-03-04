import { google, classroom_v1 } from "googleapis";
import { createAuthenticatedClient } from "@/lib/google/oauth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  itemsSynced: number;
  modules: number;
  assignments: number;
  announcements: number;
  /** Step-level errors — sync continues even if one step fails */
  stepErrors: { step: string; error: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDueAt(
  dueDate?: classroom_v1.Schema$Date | null,
  dueTime?: classroom_v1.Schema$TimeOfDay | null
): string | null {
  if (!dueDate?.year || !dueDate?.month || !dueDate?.day) return null;
  const d = new Date(
    Date.UTC(
      dueDate.year,
      dueDate.month - 1,
      dueDate.day,
      dueTime?.hours ?? 23,
      dueTime?.minutes ?? 59,
      0
    )
  );
  return d.toISOString();
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "Untitled";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Extract a human-readable message from Google API errors */
function googleErrorMessage(err: unknown): string {
  // googleapis throws GaxiosError — response.data.error.message is most useful
  const gaxios = err as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };
  return (
    gaxios?.response?.data?.error?.message ??
    (err instanceof Error ? err.message : "Unknown error")
  );
}

/** Returns true if the error is a Google 401 (expired token) */
function isUnauthorized(err: unknown): boolean {
  const code =
    (err as { code?: number })?.code ??
    (err as { response?: { status?: number } })?.response?.status;
  return code === 401;
}

// Ensure a "General" fallback module exists for uncategorised items
async function ensureGeneralModule(
  admin: ReturnType<typeof supabaseAdmin>,
  cohortId: string,
  userId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("modules")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("title", "General")
    .eq("source", "google_classroom")
    .is("google_id", null)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("modules")
    .insert({
      cohort_id: cohortId,
      title: "General",
      source: "google_classroom",
      created_by: userId,
      position: 9999,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error("Failed to create General module");
  return created.id as string;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function syncCourse(params: {
  googleCourseId: string;
  cohortId: string;
  refreshToken: string;
  connectionId: string;
  userId: string;
}): Promise<SyncResult> {
  const { googleCourseId, cohortId, refreshToken, connectionId, userId } = params;

  const admin = supabaseAdmin();
  const authClient = createAuthenticatedClient(refreshToken);
  const classroom = google.classroom({ version: "v1", auth: authClient });

  let totalModules = 0;
  let totalAssignments = 0;
  let totalAnnouncements = 0;
  const stepErrors: { step: string; error: string }[] = [];
  let tokenExpired = false;

  // ── 1. Sync Topics → modules ───────────────────────────────────────────────
  const topicToModuleId = new Map<string, string>();

  try {
    const allTopics: classroom_v1.Schema$Topic[] = [];
    let pageToken: string | undefined;
    do {
      const res = await classroom.courses.topics.list({
        courseId: googleCourseId,
        pageSize: 200,
        pageToken,
      });
      allTopics.push(...(res.data.topic ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (allTopics.length > 0) {
      const topicGoogleIds = allTopics.map((t) => t.topicId!);

      const { data: existingModules } = await admin
        .from("modules")
        .select("id, google_id, title")
        .eq("cohort_id", cohortId)
        .in("google_id", topicGoogleIds);

      const existingByGoogleId = new Map(
        (existingModules ?? []).map((m) => [m.google_id as string, m])
      );

      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; title: string; position: number }[] = [];

      allTopics.forEach((topic, i) => {
        const existing = existingByGoogleId.get(topic.topicId!);
        if (existing) {
          toUpdate.push({ id: existing.id as string, title: topic.name!, position: i });
        } else {
          toInsert.push({
            cohort_id: cohortId,
            title: topic.name!,
            google_id: topic.topicId!,
            source: "google_classroom",
            created_by: userId,
            position: i,
          });
        }
      });

      if (toInsert.length > 0) {
        const { error } = await admin.from("modules").insert(toInsert);
        if (error) throw new Error(`DB insert failed: ${error.message}`);
        totalModules += toInsert.length;
      }

      for (const upd of toUpdate) {
        await admin
          .from("modules")
          .update({ title: upd.title, position: upd.position })
          .eq("id", upd.id);
      }
      totalModules += toUpdate.length;
    }

    // Build lookup map from the DB (includes both new and pre-existing)
    const { data: allModules } = await admin
      .from("modules")
      .select("id, google_id")
      .eq("cohort_id", cohortId)
      .not("google_id", "is", null);

    for (const m of allModules ?? []) {
      topicToModuleId.set(m.google_id as string, m.id as string);
    }
  } catch (err) {
    if (isUnauthorized(err)) tokenExpired = true;
    const msg = googleErrorMessage(err);
    console.error("[sync] topics step failed:", msg);
    stepErrors.push({ step: "topics", error: msg });
  }

  // Lazy-create the General module only when needed
  let generalModuleId: string | null = null;
  const getGeneralModuleId = async (): Promise<string> => {
    if (!generalModuleId) {
      generalModuleId = await ensureGeneralModule(admin, cohortId, userId);
    }
    return generalModuleId;
  };

  // ── 2. Sync CourseWork → assignments ───────────────────────────────────────
  if (!tokenExpired) {
    try {
      const allCourseWork: classroom_v1.Schema$CourseWork[] = [];
      let pageToken: string | undefined;
      do {
        const res = await classroom.courses.courseWork.list({
          courseId: googleCourseId,
          pageSize: 100,
          pageToken,
          orderBy: "updateTime desc",
        });
        allCourseWork.push(...(res.data.courseWork ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      if (allCourseWork.length > 0) {
        const cwGoogleIds = allCourseWork.map((cw) => cw.id!);

        const { data: cohortModules } = await admin
          .from("modules")
          .select("id")
          .eq("cohort_id", cohortId);
        const cohortModuleIds = (cohortModules ?? []).map((m) => m.id as string);

        const { data: existingAssignments } = cohortModuleIds.length
          ? await admin
              .from("assignments")
              .select("id, google_id")
              .in("module_id", cohortModuleIds)
              .in("google_id", cwGoogleIds)
          : { data: [] };

        const existingByGoogleId = new Map(
          (existingAssignments ?? []).map((a) => [a.google_id as string, a.id as string])
        );

        const toInsert: Record<string, unknown>[] = [];

        for (let i = 0; i < allCourseWork.length; i++) {
          const cw = allCourseWork[i];
          const moduleId = cw.topicId
            ? (topicToModuleId.get(cw.topicId) ?? (await getGeneralModuleId()))
            : await getGeneralModuleId();

          const row: Record<string, unknown> = {
            module_id: moduleId,
            title: cw.title ?? "Untitled Assignment",
            description: cw.description ?? null,
            due_at: buildDueAt(cw.dueDate, cw.dueTime),
            max_points: cw.maxPoints ?? null,
            position: i,
            source: "google_classroom",
            google_id: cw.id!,
            created_by: userId,
            metadata: {
              workType: cw.workType,
              alternateLink: cw.alternateLink,
              state: cw.state,
            },
          };

          const existingId = existingByGoogleId.get(cw.id!);
          if (existingId) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { google_id: _g, created_by: _c, source: _s, ...updateFields } = row;
            await admin.from("assignments").update(updateFields).eq("id", existingId);
          } else {
            toInsert.push(row);
          }
        }

        if (toInsert.length > 0) {
          const { error } = await admin.from("assignments").insert(toInsert);
          if (error) throw new Error(`DB insert failed: ${error.message}`);
        }

        totalAssignments = allCourseWork.length;
      }
    } catch (err) {
      if (isUnauthorized(err)) tokenExpired = true;
      const msg = googleErrorMessage(err);
      console.error("[sync] courseWork step failed:", msg);
      stepErrors.push({ step: "courseWork", error: msg });
    }
  }

  // ── 3. Sync Announcements ──────────────────────────────────────────────────
  if (!tokenExpired) {
    try {
      const allAnnouncements: classroom_v1.Schema$Announcement[] = [];
      let pageToken: string | undefined;
      do {
        const res = await classroom.courses.announcements.list({
          courseId: googleCourseId,
          pageSize: 100,
          pageToken,
          orderBy: "updateTime desc",
        });
        allAnnouncements.push(...(res.data.announcements ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      if (allAnnouncements.length > 0) {
        const annGoogleIds = allAnnouncements.map((a) => a.id!);

        const { data: cohortModules } = await admin
          .from("modules")
          .select("id")
          .eq("cohort_id", cohortId);
        const cohortModuleIds = (cohortModules ?? []).map((m) => m.id as string);

        const { data: existingAnnouncements } = cohortModuleIds.length
          ? await admin
              .from("announcements")
              .select("id, google_id")
              .in("module_id", cohortModuleIds)
              .in("google_id", annGoogleIds)
          : { data: [] };

        const existingByGoogleId = new Map(
          (existingAnnouncements ?? []).map((a) => [a.google_id as string, a.id as string])
        );

        const toInsert: Record<string, unknown>[] = [];

        for (const ann of allAnnouncements) {
          // googleapis typedefs omit topicId on Announcement — cast to access it
          const annTopicId = (ann as unknown as { topicId?: string }).topicId;
          const moduleId = annTopicId
            ? (topicToModuleId.get(annTopicId) ?? (await getGeneralModuleId()))
            : await getGeneralModuleId();

          const row: Record<string, unknown> = {
            module_id: moduleId,
            title: truncate(ann.text, 120),
            body: ann.text ?? null,
            published: ann.state === "PUBLISHED",
            scheduled_at: ann.scheduledTime ?? null,
            source: "google_classroom",
            google_id: ann.id!,
            created_by: userId,
          };

          const existingId = existingByGoogleId.get(ann.id!);
          if (existingId) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { google_id: _g, created_by: _c, source: _s, ...updateFields } = row;
            await admin.from("announcements").update(updateFields).eq("id", existingId);
          } else {
            toInsert.push(row);
          }
        }

        if (toInsert.length > 0) {
          const { error } = await admin.from("announcements").insert(toInsert);
          if (error) throw new Error(`DB insert failed: ${error.message}`);
        }

        totalAnnouncements = allAnnouncements.length;
      }
    } catch (err) {
      if (isUnauthorized(err)) tokenExpired = true;
      const msg = googleErrorMessage(err);
      console.error("[sync] announcements step failed:", msg);
      stepErrors.push({ step: "announcements", error: msg });
    }
  }

  // ── Mark connection invalid if token expired ────────────────────────────────
  if (tokenExpired) {
    await admin
      .from("gc_connections")
      .update({ is_valid: false })
      .eq("id", connectionId);
    throw new Error("Google token expired. Please reconnect your Google account.");
  }

  // ── Mark connection valid (in case it was previously flagged) ──────────────
  await admin
    .from("gc_connections")
    .update({ is_valid: true })
    .eq("id", connectionId);

  // If every step failed, surface a combined error
  if (stepErrors.length === 3) {
    throw new Error(
      stepErrors.map((e) => `${e.step}: ${e.error}`).join(" | ")
    );
  }

  return {
    itemsSynced: totalModules + totalAssignments + totalAnnouncements,
    modules: totalModules,
    assignments: totalAssignments,
    announcements: totalAnnouncements,
    stepErrors,
  };
}
