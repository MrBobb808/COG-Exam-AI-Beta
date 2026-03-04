import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import ProgressCard from "@/components/ProgressCard";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ensure profile exists (lazy creation)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!existingProfile) {
    await supabase.from("profiles").insert({
      user_id: user!.id,
      display_name: user!.email?.split("@")[0] ?? "User",
    });
  }

  // Fetch all active cohort memberships
  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("id, cohort_id, role, cohorts(id, name)")
    .eq("user_id", user!.id)
    .eq("status", "active");

  const cohortList = (memberships ?? []).map((m) => ({
    cohortId: m.cohort_id,
    cohortName: (m.cohorts as unknown as { id: string; name: string })?.name ?? "Course",
    role: m.role,
  }));

  const cohortIds = cohortList.map((c) => c.cohortId);

  if (cohortIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">My Dashboard</h1>
        <p className="text-sm text-text-secondary">
          You are not enrolled in any courses yet.
        </p>
      </div>
    );
  }

  // Fetch modules for all cohorts to get assignment IDs
  const { data: modules } = await supabase
    .from("modules")
    .select("id, cohort_id")
    .in("cohort_id", cohortIds);

  const moduleIds = (modules ?? []).map((m) => m.id);
  const moduleCohortMap = new Map(
    (modules ?? []).map((m) => [m.id, m.cohort_id])
  );

  // Fetch all assignments + user's submissions in parallel
  const [{ data: allAssignments }, { data: allSubmissions }] =
    moduleIds.length > 0
      ? await Promise.all([
          supabase
            .from("assignments")
            .select("id, module_id, title, due_at, max_points")
            .in("module_id", moduleIds)
            .order("due_at", { ascending: true }),
          supabase
            .from("submissions")
            .select("id, assignment_id, status, grade, submitted_at, updated_at")
            .eq("user_id", user!.id),
        ])
      : [
          { data: [] as { id: string; module_id: string; title: string; due_at: string | null; max_points: number | null }[] },
          { data: [] as { id: string; assignment_id: string; status: string; grade: number | null; submitted_at: string | null; updated_at: string | null }[] },
        ];

  // Fetch user's discussion comments
  const assignmentIds = (allAssignments ?? []).map((a) => a.id);
  const { data: allComments } =
    assignmentIds.length > 0
      ? await supabase
          .from("discussions")
          .select("id, assignment_id")
          .eq("user_id", user!.id)
          .in("assignment_id", assignmentIds)
      : { data: [] as { id: string; assignment_id: string }[] };

  // Map assignments to cohorts
  type AssignmentWithCohort = {
    id: string;
    module_id: string;
    title: string;
    due_at: string | null;
    max_points: number | null;
    cohortId: string;
  };

  const assignmentsWithCohort: AssignmentWithCohort[] = (allAssignments ?? []).map(
    (a) => ({
      ...a,
      cohortId: moduleCohortMap.get(a.module_id) ?? "",
    })
  );

  const submissionsByAssignment = new Map(
    (allSubmissions ?? []).map((s) => [s.assignment_id, s])
  );

  // Build comments-per-cohort map
  const commentsByCohort = new Map<string, number>();
  for (const comment of allComments ?? []) {
    const a = assignmentsWithCohort.find((x) => x.id === comment.assignment_id);
    if (a) {
      commentsByCohort.set(a.cohortId, (commentsByCohort.get(a.cohortId) ?? 0) + 1);
    }
  }

  // Build per-cohort stats
  const cohortStats = cohortList.map((c) => {
    const cohortAssignments = assignmentsWithCohort.filter(
      (a) => a.cohortId === c.cohortId
    );
    const totalAssignments = cohortAssignments.length;

    let submittedCount = 0;
    let gradedCount = 0;
    let gradeSum = 0;
    let onTimeCount = 0;

    for (const a of cohortAssignments) {
      const sub = submissionsByAssignment.get(a.id);
      if (sub && (sub.status === "submitted" || sub.status === "graded")) {
        submittedCount++;
        if (a.due_at && sub.submitted_at && new Date(sub.submitted_at) <= new Date(a.due_at)) {
          onTimeCount++;
        }
      }
      if (sub && sub.status === "graded" && sub.grade != null) {
        gradedCount++;
        gradeSum += Number(sub.grade);
      }
    }

    const averageGrade = gradedCount > 0 ? gradeSum / gradedCount : null;
    const commentCount = commentsByCohort.get(c.cohortId) ?? 0;

    const engagementScore =
      submittedCount * 10 + gradedCount * 5 + onTimeCount * 5 + commentCount * 3;

    const now = new Date();
    const upcomingAssignments = cohortAssignments
      .filter(
        (a) =>
          a.due_at &&
          new Date(a.due_at) > now &&
          !submissionsByAssignment.has(a.id)
      )
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        title: a.title,
        due_at: a.due_at,
        cohortId: a.cohortId,
      }));

    return {
      ...c,
      totalAssignments,
      submittedCount,
      gradedCount,
      averageGrade,
      commentCount,
      engagementScore,
      upcomingAssignments,
    };
  });

  const now = new Date();
  const globalUpcoming = assignmentsWithCohort
    .filter(
      (a) =>
        a.due_at &&
        new Date(a.due_at) > now &&
        !submissionsByAssignment.has(a.id)
    )
    .slice(0, 5);

  const recentSubmissions = (allSubmissions ?? [])
    .sort((a, b) => {
      const aTime = a.updated_at ?? a.submitted_at ?? "";
      const bTime = b.updated_at ?? b.submitted_at ?? "";
      return bTime.localeCompare(aTime);
    })
    .slice(0, 5);

  const assignmentTitleMap = new Map(
    (allAssignments ?? []).map((a) => [a.id, a.title])
  );
  const assignmentCohortMap = new Map(
    assignmentsWithCohort.map((a) => [a.id, a.cohortId])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Your learning overview</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {cohortStats.map((c) => (
          <ProgressCard
            key={c.cohortId}
            cohortName={c.cohortName}
            cohortId={c.cohortId}
            totalAssignments={c.totalAssignments}
            submittedCount={c.submittedCount}
            gradedCount={c.gradedCount}
            averageGrade={c.averageGrade}
            commentCount={c.commentCount}
            engagementScore={c.engagementScore}
            upcomingAssignments={c.upcomingAssignments}
          />
        ))}
      </div>

      {globalUpcoming.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-navy rounded-full inline-block" />
            Upcoming Assignments
          </h2>
          <div className="space-y-2">
            {globalUpcoming.map((a) => (
              <Link
                key={a.id}
                href={`/app/courses/${a.cohortId}/assignments/${a.id}`}
                className="bg-white border border-border rounded-xl p-4 flex items-center justify-between hover:border-navy/20 hover:shadow-sm transition-all duration-150 block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-navy rounded-full shrink-0" />
                  <span className="text-sm font-medium text-text-primary">{a.title}</span>
                </div>
                {a.due_at && (
                  <span className="text-xs font-medium text-text-secondary bg-background border border-border px-2.5 py-1 rounded-full shrink-0">
                    Due {new Date(a.due_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentSubmissions.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-border rounded-full inline-block" />
            Recent Activity
          </h2>
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            {recentSubmissions.map((s, idx) => {
              const statusConfig: Record<string, { label: string; cls: string }> = {
                draft: { label: "Draft", cls: "bg-slate-100 text-text-secondary" },
                submitted: { label: "Submitted", cls: "bg-navy/10 text-navy" },
                graded: { label: "Graded", cls: "bg-green-100 text-green-700" },
                returned: { label: "Returned", cls: "bg-orange-100 text-orange-700" },
              };
              const cfg = statusConfig[s.status] ?? statusConfig.draft;
              const aCohortId = assignmentCohortMap.get(s.assignment_id) ?? "";

              return (
                <Link
                  key={s.id}
                  href={`/app/courses/${aCohortId}/assignments/${s.assignment_id}`}
                  className={`flex items-center justify-between px-5 py-3.5 hover:bg-background transition-colors ${idx !== recentSubmissions.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm text-text-primary truncate">
                      {assignmentTitleMap.get(s.assignment_id) ?? "Assignment"}
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary shrink-0 ml-4">
                    {new Date(s.updated_at ?? s.submitted_at ?? "").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {cohortStats.every((c) => c.totalAssignments === 0) &&
        globalUpcoming.length === 0 &&
        recentSubmissions.length === 0 && (
          <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">📚</span>
            <h3 className="text-base font-semibold text-text-primary mb-1">No assignments yet</h3>
            <p className="text-sm text-text-secondary max-w-sm">
              Check your{" "}
              <Link href="/app/courses" className="text-navy hover:underline">
                courses
              </Link>{" "}
              for available content.
            </p>
          </div>
        )}
    </div>
  );
}
