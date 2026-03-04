import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import SubmissionForm from "@/components/SubmissionForm";
import SubmissionStatus from "@/components/SubmissionStatus";
import DiscussionThread from "@/components/DiscussionThread";

type Props = {
  params: Promise<{ cohortId: string; assignmentId: string }>;
};

export default async function AssignmentDetailPage({ params }: Props) {
  const { cohortId, assignmentId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS enforces membership
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

  // Fetch assignment + cohort in parallel
  const [{ data: assignment }, { data: cohort }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, description, due_at, max_points, module_id, metadata")
      .eq("id", assignmentId)
      .single(),
    supabase
      .from("cohorts")
      .select("name")
      .eq("id", cohortId)
      .single(),
  ]);

  if (!assignment) {
    notFound();
  }

  // Fetch module name for breadcrumb
  const { data: mod } = await supabase
    .from("modules")
    .select("id, title, cohort_id")
    .eq("id", assignment.module_id)
    .single();

  // Verify assignment belongs to this cohort
  if (!mod || mod.cohort_id !== cohortId) {
    notFound();
  }

  // Fetch user's submission (if any)
  const { data: submission } = await supabase
    .from("submissions")
    .select(
      "id, content, file_url, status, grade, feedback, submitted_at, graded_at"
    )
    .eq("assignment_id", assignmentId)
    .eq("user_id", user!.id)
    .maybeSingle();

  // Fetch discussions with profile info
  const { data: discussions } = await supabase
    .from("discussions")
    .select("id, user_id, parent_id, body, created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at");

  // Fetch profiles for discussion authors
  const authorIds = [...new Set((discussions ?? []).map((d) => d.user_id))];
  const { data: profiles } =
    authorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", authorIds)
      : {
          data: [] as {
            user_id: string;
            display_name: string | null;
            avatar_url: string | null;
          }[],
        };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Fetch reactions for all discussions
  const discussionIds = (discussions ?? []).map((d) => d.id);
  const admin = supabaseAdmin();

  let allReactions: { discussion_id: string; user_id: string; emoji: string }[] = [];
  if (discussionIds.length > 0) {
    const { data } = await admin
      .from("discussion_reactions")
      .select("discussion_id, user_id, emoji")
      .in("discussion_id", discussionIds);
    allReactions = (data ?? []) as typeof allReactions;
  }

  // Group reactions by discussion_id → { emoji, count, reacted }
  const reactionsByDiscussion = new Map<
    string,
    { emoji: string; count: number; reacted: boolean }[]
  >();

  for (const r of allReactions) {
    const list = reactionsByDiscussion.get(r.discussion_id) ?? [];
    const existing = list.find((e) => e.emoji === r.emoji);
    if (existing) {
      existing.count++;
      if (r.user_id === user!.id) existing.reacted = true;
    } else {
      list.push({
        emoji: r.emoji,
        count: 1,
        reacted: r.user_id === user!.id,
      });
    }
    reactionsByDiscussion.set(r.discussion_id, list);
  }

  const discussionsWithProfiles = (discussions ?? []).map((d) => ({
    ...d,
    profile: profileMap.get(d.user_id) ?? null,
    reactions: reactionsByDiscussion.get(d.id) ?? [],
  }));

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
        <Link href="/app/courses" className="hover:text-blue-600">
          Courses
        </Link>
        <span>/</span>
        <Link
          href={`/app/courses/${cohortId}`}
          className="hover:text-blue-600"
        >
          {cohort?.name ?? "Course"}
        </Link>
        <span>/</span>
        <Link
          href={`/app/courses/${cohortId}/modules/${mod.id}`}
          className="hover:text-blue-600"
        >
          {mod.title}
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">
          {assignment.title}
        </span>
      </div>

      {/* Assignment header */}
      <div>
        <h1 className="text-xl font-semibold">{assignment.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {assignment.max_points != null && (
            <span>{assignment.max_points} points</span>
          )}
          {assignment.due_at && (
            <span>
              Due{" "}
              {new Date(assignment.due_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {assignment.description && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-line">{assignment.description}</p>
        </div>
      )}

      {/* Submission section */}
      {!isStaff && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Your Submission</h2>
          <SubmissionStatus
            submission={submission}
            maxPoints={assignment.max_points}
          />
          <SubmissionForm
            assignmentId={assignmentId}
            cohortId={cohortId}
            existingSubmission={submission}
          />
        </section>
      )}

      {/* Discussion */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Discussion</h2>
        <DiscussionThread
          assignmentId={assignmentId}
          initialComments={discussionsWithProfiles}
          currentUserId={user!.id}
          isStaff={isStaff}
        />
      </section>
    </div>
  );
}
