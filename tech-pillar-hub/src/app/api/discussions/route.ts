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

  let body: { assignmentId: string; parentId?: string; body: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assignmentId, parentId, body: commentBody } = body;

  if (!assignmentId || !commentBody?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: assignmentId, body" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify assignment exists and get cohort
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, module_id, modules(cohort_id)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 }
    );
  }

  const cohortId = (assignment.modules as unknown as { cohort_id: string })
    .cohort_id;

  // Verify membership
  const { data: membership } = await admin
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this course" },
      { status: 403 }
    );
  }

  // If parentId provided, verify it belongs to the same assignment
  if (parentId) {
    const { data: parent } = await admin
      .from("discussions")
      .select("id, assignment_id")
      .eq("id", parentId)
      .single();

    if (!parent || parent.assignment_id !== assignmentId) {
      return NextResponse.json(
        { error: "Parent comment not found or does not belong to this assignment" },
        { status: 400 }
      );
    }
  }

  // Ensure profile exists (lazy creation)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from("profiles").insert({
      user_id: user.id,
      display_name: user.email?.split("@")[0] ?? "User",
    });
  }

  const { data: comment, error: insertError } = await admin
    .from("discussions")
    .insert({
      assignment_id: assignmentId,
      user_id: user.id,
      parent_id: parentId ?? null,
      body: commentBody.trim(),
    })
    .select("id, user_id, parent_id, body, created_at")
    .single();

  if (insertError) {
    console.error("Failed to create comment:", insertError);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }

  // Fetch profile for response
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(
    { comment: { ...comment, profile } },
    { status: 201 }
  );
}
