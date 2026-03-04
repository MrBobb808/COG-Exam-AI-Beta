import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const moduleId = request.nextUrl.searchParams.get("moduleId");

  if (!moduleId) {
    return NextResponse.json(
      { error: "Missing moduleId parameter" },
      { status: 400 }
    );
  }

  // RLS ensures user can only see flashcards in modules they have access to
  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select("id, front, back, source, created_at")
    .eq("module_id", moduleId)
    .order("created_at");

  if (error) {
    console.error("Failed to fetch flashcards:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcards" },
      { status: 500 }
    );
  }

  // Fetch user's review states
  const flashcardIds = (flashcards ?? []).map((f) => f.id);
  let reviews: { flashcard_id: string; rating: string; interval_days: number; ease_factor: number; next_review_at: string; reviewed_at: string }[] = [];

  if (flashcardIds.length > 0) {
    const { data } = await supabase
      .from("flashcard_reviews")
      .select("flashcard_id, rating, interval_days, ease_factor, next_review_at, reviewed_at")
      .eq("user_id", user.id)
      .in("flashcard_id", flashcardIds);

    reviews = (data ?? []) as typeof reviews;
  }

  const reviewMap = new Map(reviews.map((r) => [r.flashcard_id, r]));

  const cardsWithReviews = (flashcards ?? []).map((f) => ({
    ...f,
    review: reviewMap.get(f.id) ?? null,
  }));

  return NextResponse.json({ flashcards: cardsWithReviews });
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { moduleId: string; front: string; back: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { moduleId, front, back } = body;

  if (!moduleId || !front?.trim() || !back?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: moduleId, front, back" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify module exists and user is staff
  const { data: module } = await admin
    .from("modules")
    .select("id, cohort_id")
    .eq("id", moduleId)
    .single();

  if (!module) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", module.cohort_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "instructor")) {
    return NextResponse.json(
      { error: "Only staff can create flashcards" },
      { status: 403 }
    );
  }

  const { data: flashcard, error: insertError } = await admin
    .from("flashcards")
    .insert({
      module_id: moduleId,
      front: front.trim(),
      back: back.trim(),
      source: "manual",
      created_by: user.id,
    })
    .select("id, front, back, source, created_at")
    .single();

  if (insertError) {
    console.error("Failed to create flashcard:", insertError);
    return NextResponse.json(
      { error: "Failed to create flashcard" },
      { status: 500 }
    );
  }

  return NextResponse.json({ flashcard }, { status: 201 });
}
