import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import AnnouncementsList from "@/components/AnnouncementsList";
import EnrollmentManager from "@/components/EnrollmentManager";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function CohortDetailPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const isStaff =
    membership.role === "admin" || membership.role === "instructor";

  const [{ data: cohort }, { data: modules }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, description")
      .eq("id", cohortId)
      .single(),
    supabase
      .from("modules")
      .select("id, title, description, position")
      .eq("cohort_id", cohortId)
      .order("position"),
  ]);

  if (!cohort) {
    notFound();
  }

  const moduleIds = (modules ?? []).map((m) => m.id);

  const [{ data: resources }, { data: announcements }, { data: assignments }] =
    moduleIds.length > 0
      ? await Promise.all([
          supabase
            .from("resources")
            .select("id, module_id, title, description, url, position")
            .in("module_id", moduleIds)
            .order("position"),
          supabase
            .from("announcements")
            .select("id, module_id, title, body, created_at")
            .in("module_id", moduleIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("assignments")
            .select(
              "id, module_id, title, description, due_at, max_points, position"
            )
            .in("module_id", moduleIds)
            .order("position"),
        ])
      : [{ data: [] as never[] }, { data: [] as never[] }, { data: [] as never[] }];

  type Resource = { id: string; module_id: string; title: string; description: string | null; url: string | null; position: number };
  type Assignment = { id: string; module_id: string; title: string; description: string | null; due_at: string | null; max_points: number | null; position: number };

  const resourcesByModule = new Map<string, Resource[]>();
  for (const r of (resources ?? []) as Resource[]) {
    const list = resourcesByModule.get(r.module_id) ?? [];
    list.push(r);
    resourcesByModule.set(r.module_id, list);
  }

  const assignmentsByModule = new Map<string, Assignment[]>();
  for (const a of (assignments ?? []) as Assignment[]) {
    const list = assignmentsByModule.get(a.module_id) ?? [];
    list.push(a);
    assignmentsByModule.set(a.module_id, list);
  }

  return (
    <div className="space-y-8">
      {/* Cohort Header */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-navy to-navy-light px-6 py-5">
          <Link href="/app/courses" className="inline-flex items-center gap-1 text-white/50 hover:text-white text-xs mb-3 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            All courses
          </Link>
          <h1 className="text-xl font-bold text-white">{cohort.name}</h1>
          {cohort.description && (
            <p className="text-white/60 text-sm mt-1">{cohort.description}</p>
          )}
        </div>
        {/* Quick Actions */}
        <div className="px-6 py-4 flex flex-wrap gap-2 border-t border-border">
          <Link href={`/app/courses/${cohortId}/chat`} className="inline-flex items-center gap-2 text-sm bg-navy/10 text-navy border border-navy/20 rounded-lg px-3 py-1.5 hover:bg-navy/15 transition-colors font-medium">
            🤖 Tech Mentor
          </Link>
          <Link href={`/app/courses/${cohortId}/sermon-lab`} className="inline-flex items-center gap-2 text-sm bg-background text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors font-medium">
            📝 Sermon Lab
          </Link>
          <Link href={`/app/courses/${cohortId}/games`} className="inline-flex items-center gap-2 text-sm bg-background text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors font-medium">
            🃏 Flashcards
          </Link>
          <Link href={`/app/courses/${cohortId}/community`} className="inline-flex items-center gap-2 text-sm bg-background text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors font-medium">
            💬 Community
          </Link>
          <Link href={`/app/courses/${cohortId}/videos`} className="inline-flex items-center gap-2 text-sm bg-background text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors font-medium">
            🎬 Videos
          </Link>
          {isStaff && (
            <Link href={`/app/courses/${cohortId}/mentor`} className="inline-flex items-center gap-2 text-sm bg-crimson/10 text-crimson border border-crimson/20 rounded-lg px-3 py-1.5 hover:bg-crimson/15 transition-colors font-medium">
              👥 Mentor Panel
            </Link>
          )}
        </div>
      </div>

      {/* Announcements */}
      {announcements && (announcements as { id: string; title: string; body: string | null; created_at: string }[]).length > 0 && (
        <AnnouncementsList
          announcements={
            (announcements as { id: string; title: string; body: string | null; created_at: string }[])
          }
        />
      )}

      {/* Modules */}
      {(!modules || modules.length === 0) && (
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-12 text-center">
          <span className="text-4xl mb-3">📋</span>
          <p className="text-sm text-text-secondary">No modules available yet. Content will appear after syncing from Google Classroom.</p>
        </div>
      )}

      <div className="space-y-4">
        {modules?.map((mod) => {
          const modResources = resourcesByModule.get(mod.id) ?? [];
          const modAssignments = assignmentsByModule.get(mod.id) ?? [];

          if (
            mod.title === "General" &&
            modResources.length === 0 &&
            modAssignments.length === 0
          ) {
            return null;
          }

          return (
            <div key={mod.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              {/* Module header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <Link
                  href={`/app/courses/${cohortId}/modules/${mod.id}`}
                  className="font-semibold text-text-primary hover:text-navy transition-colors"
                >
                  {mod.title}
                </Link>
                <span className="text-xs text-text-secondary bg-background border border-border px-2.5 py-1 rounded-full">
                  {modAssignments.length} assignment{modAssignments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {mod.description && (
                <p className="px-5 py-3 text-sm text-text-secondary border-b border-border bg-background/50">
                  {mod.description}
                </p>
              )}

              <div className="divide-y divide-border/50">
                {/* Resources */}
                {modResources.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-background transition-colors">
                    <span className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      📄
                    </span>
                    <div className="min-w-0">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-navy hover:underline"
                        >
                          {r.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-text-primary">{r.title}</p>
                      )}
                      {r.description && (
                        <p className="text-xs text-text-secondary mt-0.5 truncate">{r.description}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Assignments */}
                {modAssignments.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/courses/${cohortId}/assignments/${a.id}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-navy/5 transition-colors group"
                  >
                    <span className="w-5 h-5 rounded bg-navy/10 text-navy flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ✏️
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary group-hover:text-navy transition-colors truncate">
                        {a.title}
                      </p>
                      {a.description && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-text-secondary shrink-0 space-y-0.5">
                      {a.max_points != null && (
                        <p className="font-medium text-text-primary">{a.max_points} pts</p>
                      )}
                      {a.due_at && (
                        <p>
                          Due{" "}
                          {new Date(a.due_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}

                {modResources.length === 0 && modAssignments.length === 0 && (
                  <p className="px-5 py-4 text-sm text-text-secondary">No content yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enrollment Manager (staff only) */}
      {isStaff && (
        <EnrollmentSection cohortId={cohortId} />
      )}
    </div>
  );
}

async function EnrollmentSection({ cohortId }: { cohortId: string }) {
  const admin = supabaseAdmin();

  const { data: members } = await admin
    .from("cohort_members")
    .select("id, user_id, role, status")
    .eq("cohort_id", cohortId)
    .eq("status", "active")
    .order("role");

  const {
    data: { users: allUsers },
  } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const userEmailMap = new Map(
    allUsers.map((u) => [u.id, u.email ?? "unknown"])
  );

  const membersWithEmail = (members ?? []).map((m) => ({
    ...m,
    email: userEmailMap.get(m.user_id) ?? "unknown",
  }));

  return (
    <section className="space-y-3 border-t border-border pt-8">
      <h2 className="text-lg font-medium text-text-primary">Manage Students</h2>
      <EnrollmentManager cohortId={cohortId} members={membersWithEmail} />
    </section>
  );
}
