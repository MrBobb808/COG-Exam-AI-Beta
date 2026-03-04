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

  // Fetch the comment
  const { data: comment } = await admin
    .from("discussions")
    .select("id, user_id, assignment_id")
    .eq("id", id)
    .single();

  if (!comment) {
    return NextResponse.json(
      { error: "Comment not found" },
      { status: 404 }
    );
  }

  // Check authorization: must be author or cohort staff
  if (comment.user_id !== user.id) {
    const { data: assignment } = await admin
      .from("assignments")
      .select("module_id, modules(cohort_id)")
      .eq("id", comment.assignment_id)
      .single();

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const cohortId = (assignment.modules as unknown as { cohort_id: string })
      .cohort_id;

    const { data: staffCheck } = await admin
      .from("cohort_members")
      .select("id")
      .eq("cohort_id", cohortId)
      .eq("user_id", user.id)
      .in("role", ["admin", "instructor"])
      .eq("status", "active")
      .limit(1)
      .single();

    if (!staffCheck) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const { error: deleteError } = await admin
    .from("discussions")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete comment:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
