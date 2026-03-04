import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import FlashcardStudy from "@/components/FlashcardStudy";

type Props = {
  params: Promise<{ cohortId: string; moduleId: string }>;
};

export default async function FlashcardStudyPage({ params }: Props) {
  const { cohortId, moduleId } = await params;
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

  const isStaff =
    membership.role === "admin" || membership.role === "instructor";

  // Fetch module and cohort
  const [{ data: module }, { data: cohort }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, title, cohort_id")
      .eq("id", moduleId)
      .eq("cohort_id", cohortId)
      .single(),
    supabase.from("cohorts").select("name").eq("id", cohortId).single(),
  ]);

  if (!module || !cohort) {
    notFound();
  }

  const admin = supabaseAdmin();

  // Fetch flashcards for this module
  const { data: flashcards } = await admin
    .from("flashcards")
    .select("id, front, back, source, created_at")
    .eq("module_id", moduleId)
    .order("created_at");

  // Fetch user's review states
  const flashcardIds = (flashcards ?? []).map((f) => f.id);
  let reviews: {
    flashcard_id: string;
    rating: string;
    interval_days: number;
    next_review_at: string;
  }[] = [];

  if (flashcardIds.length > 0) {
    const { data } = await supabase
      .from("flashcard_reviews")
      .select("flashcard_id, rating, interval_days, next_review_at")
      .eq("user_id", user!.id)
      .in("flashcard_id", flashcardIds);

    reviews = (data ?? []) as typeof reviews;
  }

  const reviewMap = new Map(reviews.map((r) => [r.flashcard_id, r]));

  const cardsWithReviews = (flashcards ?? []).map((f) => ({
    id: f.id,
    front: f.front,
    back: f.back,
    source: f.source,
    review: reviewMap.get(f.id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/courses/${cohortId}/games`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Flashcards
        </Link>
        <h1 className="text-xl font-semibold mt-2">{module.title}</h1>
        <p className="text-sm text-gray-500">
          {cardsWithReviews.length} card{cardsWithReviews.length !== 1 ? "s" : ""} •{" "}
          {cohort.name}
        </p>
      </div>

      <FlashcardStudy
        cards={cardsWithReviews}
        moduleTitle={module.title}
        cohortId={cohortId}
        moduleId={moduleId}
        isStaff={isStaff}
      />
    </div>
  );
}
