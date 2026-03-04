import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function CohortGamesPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify membership
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

  // Fetch cohort + modules
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

  if (!cohort) {
    notFound();
  }

  const admin = supabaseAdmin();
  const moduleIds = (modules ?? []).map((m) => m.id);

  // Fetch flashcard counts per module
  let cardsByModule = new Map<string, number>();
  let reviewsByModule = new Map<string, { due: number; reviewed: number }>();

  if (moduleIds.length > 0) {
    const { data: flashcards } = await admin
      .from("flashcards")
      .select("id, module_id")
      .in("module_id", moduleIds);

    for (const f of flashcards ?? []) {
      cardsByModule.set(f.module_id, (cardsByModule.get(f.module_id) ?? 0) + 1);
    }

    // Get user's review states
    const flashcardIds = (flashcards ?? []).map((f) => f.id);
    if (flashcardIds.length > 0) {
      const { data: reviews } = await supabase
        .from("flashcard_reviews")
        .select("flashcard_id, next_review_at")
        .eq("user_id", user!.id)
        .in("flashcard_id", flashcardIds);

      const flashcardModuleMap = new Map(
        (flashcards ?? []).map((f) => [f.id, f.module_id])
      );

      const now = new Date();
      for (const r of reviews ?? []) {
        const modId = flashcardModuleMap.get(r.flashcard_id);
        if (!modId) continue;
        const current = reviewsByModule.get(modId) ?? { due: 0, reviewed: 0 };
        current.reviewed++;
        if (new Date(r.next_review_at) <= now) {
          current.due++;
        }
        reviewsByModule.set(modId, current);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/courses/${cohortId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to {cohort.name}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl">🃏</span>
          <div>
            <h1 className="text-xl font-semibold">Flashcards</h1>
            <p className="text-sm text-gray-500">
              Study cards for {cohort.name}
            </p>
          </div>
        </div>
      </div>

      {(!modules || modules.length === 0) && (
        <p className="text-sm text-gray-400">No modules available yet.</p>
      )}

      <div className="space-y-3">
        {modules?.map((mod) => {
          const cardCount = cardsByModule.get(mod.id) ?? 0;
          const reviewInfo = reviewsByModule.get(mod.id) ?? {
            due: 0,
            reviewed: 0,
          };
          const newCount = cardCount - reviewInfo.reviewed;

          return (
            <Link
              key={mod.id}
              href={`/app/courses/${cohortId}/games/flashcards/${mod.id}`}
              className="border rounded-lg p-4 flex items-center justify-between hover:border-blue-300 transition-colors block"
            >
              <div>
                <p className="font-medium">{mod.title}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>{cardCount} card{cardCount !== 1 ? "s" : ""}</span>
                  {reviewInfo.due > 0 && (
                    <span className="text-orange-600 font-medium">
                      {reviewInfo.due} due
                    </span>
                  )}
                  {newCount > 0 && (
                    <span className="text-blue-600">{newCount} new</span>
                  )}
                </div>
              </div>
              {cardCount > 0 ? (
                <span className="text-sm text-blue-600 font-medium">
                  Study →
                </span>
              ) : (
                <span className="text-xs text-gray-400">No cards</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
