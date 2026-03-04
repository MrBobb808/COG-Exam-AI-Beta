import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const { cohort: selectedCohortId } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, cohorts(id, name)")
    .eq("user_id", user!.id)
    .eq("status", "active");

  const cohorts = (memberships ?? []).map((m) => ({
    id: m.cohort_id,
    name: (m.cohorts as unknown as { id: string; name: string })?.name ?? "Course",
  }));

  if (cohorts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Progress</h1>
        </div>
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🏆</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No courses yet</h3>
          <p className="text-sm text-text-secondary">You are not enrolled in any courses yet.</p>
        </div>
      </div>
    );
  }

  const activeCohortId = selectedCohortId ?? cohorts[0].id;
  const activeCohortName =
    cohorts.find((c) => c.id === activeCohortId)?.name ?? "Course";

  const admin = supabaseAdmin();

  const { data: students } = await admin
    .from("cohort_members")
    .select("user_id")
    .eq("cohort_id", activeCohortId)
    .eq("role", "student")
    .eq("status", "active");

  const studentIds = (students ?? []).map((s) => s.user_id);

  if (studentIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Progress</h1>
          <p className="text-sm text-text-secondary mt-1">Top performers in {activeCohortName}</p>
        </div>
        <CohortSelector cohorts={cohorts} activeCohortId={activeCohortId} />
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🏆</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No students yet</h3>
          <p className="text-sm text-text-secondary">No students enrolled yet.</p>
        </div>
      </div>
    );
  }

  const { data: modules } = await admin
    .from("modules")
    .select("id")
    .eq("cohort_id", activeCohortId);

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: assignments } = await admin
    .from("assignments")
    .select("id, due_at")
    .in("module_id", moduleIds.length > 0 ? moduleIds : ["none"]);

  const assignmentDueMap = new Map(
    (assignments ?? []).map((a) => [a.id, a.due_at])
  );
  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const { data: submissions } = await admin
    .from("submissions")
    .select("id, user_id, assignment_id, status, submitted_at")
    .in("assignment_id", assignmentIds.length > 0 ? assignmentIds : ["none"])
    .in("user_id", studentIds);

  const { data: discussions } = await admin
    .from("discussions")
    .select("id, user_id")
    .in("assignment_id", assignmentIds.length > 0 ? assignmentIds : ["none"])
    .in("user_id", studentIds);

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", studentIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  type StudentScore = {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    score: number;
    submissionCount: number;
    commentCount: number;
  };

  const scoreMap = new Map<string, StudentScore>();

  for (const sid of studentIds) {
    const profile = profileMap.get(sid);
    scoreMap.set(sid, {
      userId: sid,
      displayName: profile?.display_name ?? "Student",
      avatarUrl: profile?.avatar_url ?? null,
      score: 0,
      submissionCount: 0,
      commentCount: 0,
    });
  }

  for (const sub of submissions ?? []) {
    const entry = scoreMap.get(sub.user_id);
    if (!entry) continue;

    if (sub.status === "submitted" || sub.status === "graded") {
      entry.score += 10;
      entry.submissionCount++;
    }
    if (sub.status === "graded") {
      entry.score += 5;
    }
    const dueAt = assignmentDueMap.get(sub.assignment_id);
    if (
      dueAt &&
      sub.submitted_at &&
      new Date(sub.submitted_at) <= new Date(dueAt)
    ) {
      entry.score += 5;
    }
  }

  for (const disc of discussions ?? []) {
    const entry = scoreMap.get(disc.user_id);
    if (!entry) continue;
    entry.score += 3;
    entry.commentCount++;
  }

  const ranked = Array.from(scoreMap.values()).sort(
    (a, b) => b.score - a.score
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Progress</h1>
        <p className="text-sm text-text-secondary mt-1">Top performers in {activeCohortName}</p>
      </div>

      <CohortSelector cohorts={cohorts} activeCohortId={activeCohortId} />

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="text-left px-5 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide w-12">#</th>
              <th className="text-left px-5 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide">Student</th>
              <th className="text-right px-5 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide">Score</th>
              <th className="text-right px-5 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Submitted</th>
              <th className="text-right px-5 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Comments</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.userId} className={`border-b border-border last:border-b-0 hover:bg-background transition-colors ${i === 0 ? "bg-amber-50/50" : ""}`}>
                <td className="px-5 py-4">
                  {i === 0 ? (
                    <span className="text-lg">🥇</span>
                  ) : i === 1 ? (
                    <span className="text-lg">🥈</span>
                  ) : i === 2 ? (
                    <span className="text-lg">🥉</span>
                  ) : (
                    <span className="text-text-secondary font-medium">{i + 1}</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar displayName={s.displayName} avatarUrl={s.avatarUrl} size="sm" />
                    <span className="font-medium text-text-primary">{s.displayName}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="font-bold text-navy text-base">{s.score}</span>
                  <span className="text-text-secondary text-xs ml-1">pts</span>
                </td>
                <td className="px-5 py-4 text-right text-text-secondary hidden sm:table-cell">{s.submissionCount}</td>
                <td className="px-5 py-4 text-right text-text-secondary hidden sm:table-cell">{s.commentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-secondary text-center">
        Scoring: +10 submission · +5 graded bonus · +5 on-time · +3 per comment
      </p>
    </div>
  );
}

function CohortSelector({
  cohorts,
  activeCohortId,
}: {
  cohorts: { id: string; name: string }[];
  activeCohortId: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {cohorts.map((c) => (
        <Link
          key={c.id}
          href={`/app/leaderboard?cohort=${c.id}`}
          className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-all duration-150 ${
            c.id === activeCohortId
              ? "bg-navy text-white border-navy shadow-sm"
              : "bg-white text-text-secondary border-border hover:border-navy/30 hover:text-navy"
          }`}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
