import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function MentorPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify staff membership
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

  // Fetch cohort + modules + assignments
  const [{ data: cohort }, { data: modules }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("name")
      .eq("id", cohortId)
      .single(),
    supabase
      .from("modules")
      .select("id, title, position")
      .eq("cohort_id", cohortId)
      .order("position"),
  ]);

  if (!cohort) notFound();

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: assignments } =
    moduleIds.length > 0
      ? await supabase
          .from("assignments")
          .select("id, module_id, title, due_at, max_points")
          .in("module_id", moduleIds)
          .order("position")
      : { data: [] as never[] };

  const assignmentIds = (assignments ?? []).map(
    (a: { id: string }) => a.id
  );

  // Count submissions per assignment
  const { data: submissions } =
    assignmentIds.length > 0
      ? await admin
          .from("submissions")
          .select("id, assignment_id, status")
          .in("assignment_id", assignmentIds)
      : { data: [] as never[] };

  // Count enrolled students
  const { data: studentCount } = await admin
    .from("cohort_members")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("role", "student")
    .eq("status", "active");

  const totalStudents = studentCount?.length ?? 0;

  // Build stats per assignment
  type AssignmentStat = {
    id: string;
    title: string;
    moduleTitle: string;
    dueAt: string | null;
    maxPoints: number | null;
    submitted: number;
    graded: number;
    total: number;
  };

  const moduleMap = new Map(
    (modules ?? []).map((m) => [m.id, m.title])
  );

  const submissionsByAssignment = new Map<
    string,
    { submitted: number; graded: number }
  >();
  for (const s of (submissions ?? []) as {
    assignment_id: string;
    status: string;
  }[]) {
    const stats = submissionsByAssignment.get(s.assignment_id) ?? {
      submitted: 0,
      graded: 0,
    };
    if (s.status === "submitted" || s.status === "graded") {
      stats.submitted++;
    }
    if (s.status === "graded") {
      stats.graded++;
    }
    submissionsByAssignment.set(s.assignment_id, stats);
  }

  const assignmentStats: AssignmentStat[] = (
    (assignments ?? []) as {
      id: string;
      module_id: string;
      title: string;
      due_at: string | null;
      max_points: number | null;
    }[]
  ).map((a) => {
    const stats = submissionsByAssignment.get(a.id) ?? {
      submitted: 0,
      graded: 0,
    };
    return {
      id: a.id,
      title: a.title,
      moduleTitle: moduleMap.get(a.module_id) ?? "Module",
      dueAt: a.due_at,
      maxPoints: a.max_points,
      submitted: stats.submitted,
      graded: stats.graded,
      total: totalStudents,
    };
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500">
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
        <span className="text-gray-900 dark:text-gray-100">Mentor Panel</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Mentor Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          {totalStudents} students enrolled
        </p>
      </div>

      {assignmentStats.length === 0 && (
        <p className="text-sm text-gray-500">No assignments yet.</p>
      )}

      <div className="space-y-3">
        {assignmentStats.map((a) => {
          const progress =
            a.total > 0 ? Math.round((a.submitted / a.total) * 100) : 0;
          const needsGrading = a.submitted - a.graded;

          return (
            <Link
              key={a.id}
              href={`/app/courses/${cohortId}/mentor/${a.id}`}
              className="border rounded-lg p-4 block hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.moduleTitle}</p>
                </div>
                <div className="text-right text-sm shrink-0">
                  {needsGrading > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                      {needsGrading} to grade
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {a.submitted}/{a.total} submitted
                  </span>
                  <span>{a.graded} graded</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
