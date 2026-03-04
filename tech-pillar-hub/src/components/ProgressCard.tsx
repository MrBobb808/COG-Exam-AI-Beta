import Link from "next/link";

type Props = {
  cohortName: string;
  cohortId: string;
  totalAssignments: number;
  submittedCount: number;
  gradedCount: number;
  averageGrade: number | null;
  commentCount?: number;
  engagementScore?: number;
  upcomingAssignments: {
    id: string;
    title: string;
    due_at: string | null;
    cohortId: string;
  }[];
};

export default function ProgressCard({
  cohortName,
  cohortId,
  totalAssignments,
  submittedCount,
  gradedCount,
  averageGrade,
  commentCount = 0,
  engagementScore = 0,
  upcomingAssignments,
}: Props) {
  const progress =
    totalAssignments > 0
      ? Math.round((submittedCount / totalAssignments) * 100)
      : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy to-navy-light px-5 py-4">
        <Link
          href={`/app/courses/${cohortId}`}
          className="text-white font-semibold text-base hover:underline block truncate"
        >
          {cohortName}
        </Link>
        <p className="text-white/60 text-xs mt-0.5">
          {submittedCount}/{totalAssignments} assignments submitted
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Progress
            </span>
            <span className="text-sm font-bold text-text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-navy h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-text-primary">{submittedCount}</p>
            <p className="text-[11px] text-text-secondary">Submitted</p>
          </div>
          <div>
            <p className="text-lg font-bold text-success">{gradedCount}</p>
            <p className="text-[11px] text-text-secondary">Graded</p>
          </div>
          <div>
            {averageGrade != null ? (
              <>
                <p className="text-lg font-bold text-text-primary">{averageGrade.toFixed(1)}</p>
                <p className="text-[11px] text-text-secondary">Avg Grade</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-crimson">{engagementScore}</p>
                <p className="text-[11px] text-text-secondary">Points</p>
              </>
            )}
          </div>
        </div>

        {/* Secondary stats */}
        {(commentCount > 0 || engagementScore > 0) && (
          <div className="flex items-center justify-between text-xs text-text-secondary border-t border-border pt-3">
            {commentCount > 0 && (
              <span>💬 {commentCount} discussion{commentCount !== 1 ? "s" : ""}</span>
            )}
            {engagementScore > 0 && (
              <Link
                href={`/app/leaderboard?cohort=${cohortId}`}
                className="text-crimson hover:text-crimson-dark font-medium"
              >
                ⭐ {engagementScore} pts · Leaderboard →
              </Link>
            )}
          </div>
        )}

        {/* Upcoming assignments */}
        {upcomingAssignments.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
              Coming up
            </p>
            {upcomingAssignments.slice(0, 3).map((a) => (
              <Link
                key={a.id}
                href={`/app/courses/${a.cohortId}/assignments/${a.id}`}
                className="flex items-center justify-between group"
              >
                <span className="text-sm text-text-primary group-hover:text-navy truncate transition-colors">
                  {a.title}
                </span>
                {a.due_at && (
                  <span className="text-xs text-text-secondary shrink-0 ml-3 bg-[#F5F7FA] border border-border px-2 py-0.5 rounded-full">
                    {new Date(a.due_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
