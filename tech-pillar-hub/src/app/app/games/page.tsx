import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import SermonParabola from "@/components/SermonParabola";

export default async function GamesHubPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, role, cohorts(id, name)")
    .eq("user_id", user!.id)
    .eq("status", "active");

  const cohorts = (memberships ?? []).map((m) => ({
    id: m.cohort_id,
    name: (m.cohorts as unknown as { id: string; name: string })?.name ?? "Course",
    role: m.role,
  }));

  const admin = supabaseAdmin();
  const cohortIds = cohorts.map((c) => c.id);

  let cardCountsByCohort = new Map<string, number>();

  if (cohortIds.length > 0) {
    const { data: modules } = await admin
      .from("modules")
      .select("id, cohort_id")
      .in("cohort_id", cohortIds);

    const moduleIds = (modules ?? []).map((m) => m.id);

    if (moduleIds.length > 0) {
      const { data: flashcards } = await admin
        .from("flashcards")
        .select("id, module_id")
        .in("module_id", moduleIds);

      const moduleCohortMap = new Map(
        (modules ?? []).map((m) => [m.id, m.cohort_id])
      );

      for (const f of flashcards ?? []) {
        const cId = moduleCohortMap.get(f.module_id);
        if (cId) {
          cardCountsByCohort.set(cId, (cardCountsByCohort.get(cId) ?? 0) + 1);
        }
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Sermon Lab</h1>
        <p className="text-sm text-text-secondary mt-1">
          Prepare sermons with guided steps, AI boundaries, and curated prompts
        </p>
      </div>

      {/* Sermon Preparation Parabola */}
      <SermonParabola />

      {/* Cohort Sermon Submission Links */}
      {cohorts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-navy rounded-full inline-block" />
            Submit & Analyze Sermons
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {cohorts.map((c) => (
              <Link
                key={`sermon-${c.id}`}
                href={`/app/courses/${c.id}/sermon-lab`}
                className="bg-white border border-border rounded-xl p-5 hover:shadow-md hover:border-crimson/20 transition-all duration-150 block group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary group-hover:text-crimson transition-colors truncate">
                      {c.name}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Submit a sermon for AI analysis and feedback
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-crimson/10 flex items-center justify-center text-xl shrink-0">
                    📝
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs text-crimson font-medium group-hover:gap-2 transition-all">
                  Open Sermon Lab →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Flashcard Games */}
      {cohorts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1.5 h-4 bg-border rounded-full inline-block" />
            Flashcard Games
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {cohorts.map((c) => {
              const cardCount = cardCountsByCohort.get(c.id) ?? 0;
              return (
                <Link
                  key={`game-${c.id}`}
                  href={`/app/courses/${c.id}/games`}
                  className="bg-white border border-border rounded-xl p-5 hover:shadow-md hover:border-navy/20 transition-all duration-150 block group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary group-hover:text-navy transition-colors truncate">
                        {c.name}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        {cardCount > 0
                          ? `${cardCount} flashcard${cardCount !== 1 ? "s" : ""} available`
                          : "No flashcards added yet"}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${cardCount > 0 ? "bg-navy/10" : "bg-background"}`}>
                      🃏
                    </div>
                  </div>
                  {cardCount > 0 && (
                    <div className="mt-4 flex items-center gap-1 text-xs text-navy font-medium">
                      Start studying →
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {cohorts.length === 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">📖</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No courses yet</h3>
          <p className="text-sm text-text-secondary">Enroll in a course to access sermon submission and flashcard games.</p>
        </div>
      )}
    </div>
  );
}
