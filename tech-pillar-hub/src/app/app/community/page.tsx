import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function CommunityHubPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, role")
    .eq("user_id", user!.id)
    .eq("status", "active");

  const cohortIds = (memberships ?? []).map((m) => m.cohort_id);

  let cohorts: { id: string; name: string; description: string | null }[] = [];

  if (cohortIds.length > 0) {
    const { data } = await supabase
      .from("cohorts")
      .select("id, name, description")
      .in("id", cohortIds);

    cohorts = (data ?? []) as typeof cohorts;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Community</h1>
        <p className="text-sm text-text-secondary mt-1">Connect with your cohort members</p>
      </div>

      {cohorts.length === 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">💬</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No communities yet</h3>
          <p className="text-sm text-text-secondary">Enroll in a course to access the community feed.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cohorts.map((cohort) => (
          <Link
            key={cohort.id}
            href={`/app/courses/${cohort.id}/community`}
            className="bg-white border border-border rounded-xl p-5 hover:shadow-md hover:border-navy/20 transition-all duration-150 block group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-text-primary group-hover:text-navy transition-colors truncate">
                  {cohort.name}
                </h2>
                {cohort.description && (
                  <p className="text-sm text-text-secondary mt-1 line-clamp-1">{cohort.description}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center text-xl shrink-0">
                💬
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-navy font-medium">
              Open feed →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
