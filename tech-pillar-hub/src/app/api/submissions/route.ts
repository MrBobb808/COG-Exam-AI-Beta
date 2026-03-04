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

  let body: {
    assignmentId: string;
    content?: string;
    fileUrl?: string;
    status?: "draft" | "submitted";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { assignmentId, content, fileUrl, status = "draft" } = body;

  if (!assignmentId) {
    return NextResponse.json(
      { error: "Missing required field: assignmentId" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify assignment exists and get cohort for membership check
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

  // Verify user is a member of this cohort
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

  // Check for existing submission
  const { data: existing } = await admin
    .from("submissions")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Can only update draft or returned submissions
    if (existing.status !== "draft" && existing.status !== "returned") {
      return NextResponse.json(
        { error: "Cannot update a submission that has been submitted or graded" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await admin
      .from("submissions")
      .update({
        content: content ?? null,
        file_url: fileUrl ?? null,
        status,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update submission:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ submission: updated });
  }

  // Create new submission
  const { data: submission, error: insertError } = await admin
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      user_id: user.id,
      content: content ?? null,
      file_url: fileUrl ?? null,
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create submission:", insertError);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }

  return NextResponse.json({ submission }, { status: 201 });
}
