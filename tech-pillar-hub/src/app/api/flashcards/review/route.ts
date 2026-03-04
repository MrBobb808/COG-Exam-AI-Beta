import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { flashcardId: string; rating: "again" | "hard" | "easy" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { flashcardId, rating } = body;

  if (!flashcardId || !["again", "hard", "easy"].includes(rating)) {
    return NextResponse.json(
      { error: "Missing or invalid fields: flashcardId, rating (again|hard|easy)" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify flashcard exists
  const { data: flashcard } = await admin
    .from("flashcards")
    .select("id, module_id")
    .eq("id", flashcardId)
    .single();

  if (!flashcard) {
    return NextResponse.json(
      { error: "Flashcard not found" },
      { status: 404 }
    );
  }

  // Get current review state (if any)
  const { data: existing } = await admin
    .from("flashcard_reviews")
    .select("id, interval_days, ease_factor")
    .eq("flashcard_id", flashcardId)
    .eq("user_id", user.id)
    .maybeSingle();

  // SM-2 simplified algorithm
  let intervalDays = existing?.interval_days ?? 1;
  let easeFactor = Number(existing?.ease_factor ?? 2.5);

  switch (rating) {
    case "again":
      intervalDays = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;
    case "hard":
      intervalDays = intervalDays + 1;
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;
    case "easy":
      intervalDays = Math.round(intervalDays * easeFactor);
      easeFactor = easeFactor + 0.15;
      break;
  }

  const now = new Date();
  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000
  );

  if (existing) {
    // Update existing review
    const { error: updateError } = await admin
      .from("flashcard_reviews")
      .update({
        rating,
        interval_days: intervalDays,
        ease_factor: easeFactor,
        next_review_at: nextReviewAt.toISOString(),
        reviewed_at: now.toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Failed to update review:", updateError);
      return NextResponse.json(
        { error: "Failed to save review" },
        { status: 500 }
      );
    }
  } else {
    // Insert new review
    const { error: insertError } = await admin
      .from("flashcard_reviews")
      .insert({
        flashcard_id: flashcardId,
        user_id: user.id,
        rating,
        interval_days: intervalDays,
        ease_factor: easeFactor,
        next_review_at: nextReviewAt.toISOString(),
        reviewed_at: now.toISOString(),
      });

    if (insertError) {
      console.error("Failed to insert review:", insertError);
      return NextResponse.json(
        { error: "Failed to save review" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    review: {
      flashcard_id: flashcardId,
      rating,
      interval_days: intervalDays,
      ease_factor: easeFactor,
      next_review_at: nextReviewAt.toISOString(),
    },
  });
}
