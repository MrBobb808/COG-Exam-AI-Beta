import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CoursesPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships, error } = await supabase
    .from("cohort_members")
    .select(
      `id, role, cohort_id, cohorts (id, name, description)`
    )
    .eq("user_id", user!.id)
    .eq("status", "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Modules</h1>
        <p className="text-sm text-text-secondary mt-1">Your enrolled cohorts and programs</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Failed to load courses. Please refresh.
        </div>
      )}

      {!error && (!memberships || memberships.length === 0) && (
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🎓</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No courses yet</h3>
          <p className="text-sm text-text-secondary">You are not enrolled in any courses yet. Contact your admin to get started.</p>
        </div>
      )}

      {memberships && memberships.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {memberships.map((m) => {
            const cohort = m.cohorts as unknown as {
              id: string;
              name: string;
              description: string | null;
            };
            const roleColors: Record<string, string> = {
              admin: "bg-crimson/10 text-crimson",
              instructor: "bg-navy/10 text-navy",
              student: "bg-green-100 text-green-700",
            };
            const roleCls = roleColors[m.role] ?? "bg-slate-100 text-text-secondary";

            return (
              <Link
                key={m.id}
                href={`/app/courses/${cohort.id}`}
                className="bg-white border border-border rounded-xl p-5 hover:shadow-md hover:border-navy/20 transition-all duration-150 block group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-text-primary group-hover:text-navy transition-colors truncate">
                      {cohort.name}
                    </h2>
                    {cohort.description && (
                      <p className="text-sm text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                        {cohort.description}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${roleCls}`}>
                    {m.role}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs text-navy font-medium group-hover:gap-2 transition-all">
                  Open course
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
