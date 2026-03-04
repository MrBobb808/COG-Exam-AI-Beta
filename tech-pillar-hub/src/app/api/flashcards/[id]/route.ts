import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Get flashcard and its module's cohort
  const { data: flashcard } = await admin
    .from("flashcards")
    .select("id, module_id, modules(cohort_id)")
    .eq("id", id)
    .single();

  if (!flashcard) {
    return NextResponse.json(
      { error: "Flashcard not found" },
      { status: 404 }
    );
  }

  const cohortId = (flashcard.modules as unknown as { cohort_id: string })
    .cohort_id;

  // Verify staff role
  const { data: membership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "instructor")) {
    return NextResponse.json(
      { error: "Only staff can delete flashcards" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await admin
    .from("flashcards")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete flashcard:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete flashcard" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
