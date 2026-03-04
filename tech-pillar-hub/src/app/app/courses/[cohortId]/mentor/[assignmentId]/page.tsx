import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import GradeForm from "@/components/GradeForm";

type Props = {
  params: Promise<{ cohortId: string; assignmentId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function GradingPage({ params, searchParams }: Props) {
  const { cohortId, assignmentId } = await params;
  const { filter = "all" } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify staff
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) notFound();

  const isStaff =
    membership.role === "admin" || membership.role === "instructor";
  if (!isStaff) redirect(`/app/courses/${cohortId}`);

  const admin = supabaseAdmin();

  // Fetch assignment + cohort
  const [{ data: assignment }, { data: cohort }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, title, description, max_points, module_id")
      .eq("id", assignmentId)
      .single(),
    supabase
      .from("cohorts")
      .select("name")
      .eq("id", cohortId)
      .single(),
  ]);

  if (!assignment || !cohort) notFound();

  // Fetch all submissions for this assignment
  const { data: submissions } = await admin
    .from("submissions")
    .select(
      "id, user_id, content, file_url, status, grade, feedback, submitted_at, graded_at"
    )
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });

  // Fetch profiles for submission authors
  const authorIds = [
    ...new Set((submissions ?? []).map((s) => s.user_id)),
  ];
  const { data: profiles } =
    authorIds.length > 0
      ? await admin
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", authorIds)
      : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };

  // Fetch emails
  const {
    data: { users: allUsers },
  } = await admin.auth.admin.listUsers({ perPage: 1000 });

  const emailMap = new Map(
    allUsers.map((u) => [u.id, u.email ?? ""])
  );
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Apply filter
  const filteredSubmissions = (submissions ?? []).filter((s) => {
    if (filter === "needs_grading")
      return s.status === "submitted";
    if (filter === "graded") return s.status === "graded";
    return true;
  });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-100 text-blue-700",
    graded: "bg-green-100 text-green-700",
    returned: "bg-orange-100 text-orange-700",
  };

  const totalCount = (submissions ?? []).length;
  const needsGradingCount = (submissions ?? []).filter(
    (s) => s.status === "submitted"
  ).length;
  const gradedCount = (submissions ?? []).filter(
    (s) => s.status === "graded"
  ).length;

  return (
    <div className="space-y-6">
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
          {cohort.name}
        </Link>
        <span>/</span>
        <Link
          href={`/app/courses/${cohortId}/mentor`}
          className="hover:text-blue-600"
        >
          Mentor
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">
          {assignment.title}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{assignment.title}</h1>
        {assignment.max_points != null && (
          <p className="text-sm text-gray-500 mt-1">
            {assignment.max_points} points max
          </p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: "all", label: `All (${totalCount})` },
          { key: "needs_grading", label: `Needs Grading (${needsGradingCount})` },
          { key: "graded", label: `Graded (${gradedCount})` },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/app/courses/${cohortId}/mentor/${assignmentId}?filter=${tab.key}`}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              filter === tab.key
                ? "bg-blue-600 text-white border-blue-600"
                : "hover:bg-gray-50 border-gray-200"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Submissions list */}
      {filteredSubmissions.length === 0 && (
        <p className="text-sm text-gray-500">No submissions match this filter.</p>
      )}

      <div className="space-y-4">
        {filteredSubmissions.map((sub) => {
          const profile = profileMap.get(sub.user_id);
          const email = emailMap.get(sub.user_id) ?? "";

          return (
            <div key={sub.id} className="border rounded-lg p-4 space-y-3">
              {/* Student header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    displayName={profile?.display_name ?? null}
                    avatarUrl={profile?.avatar_url ?? null}
                    size="sm"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      {profile?.display_name ?? email.split("@")[0]}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {email}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[sub.status] ?? statusColors.draft}`}
                >
                  {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                </span>
              </div>

              {/* Content preview */}
              {sub.content && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-4">
                  {sub.content}
                </p>
              )}

              {sub.file_url && (
                <p className="text-xs text-gray-500">
                  File: {sub.file_url.split("/").pop()}
                </p>
              )}

              {sub.submitted_at && (
                <p className="text-xs text-gray-400">
                  Submitted{" "}
                  {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}

              {/* Grade form */}
              <GradeForm
                submissionId={sub.id}
                currentGrade={sub.grade}
                currentFeedback={sub.feedback}
                currentStatus={sub.status}
                maxPoints={assignment.max_points}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
