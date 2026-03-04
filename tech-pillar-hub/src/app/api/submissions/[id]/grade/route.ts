import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    grade?: number;
    feedback?: string;
    status?: "graded" | "returned";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Fetch submission
  const { data: submission } = await admin
    .from("submissions")
    .select("id, assignment_id, user_id, status")
    .eq("id", id)
    .single();

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 }
    );
  }

  // Verify caller is staff for this cohort
  const { data: assignment } = await admin
    .from("assignments")
    .select("module_id, modules(cohort_id)")
    .eq("id", submission.assignment_id)
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
    return NextResponse.json(
      { error: "Staff access required" },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (body.grade !== undefined) updateData.grade = body.grade;
  if (body.feedback !== undefined) updateData.feedback = body.feedback;
  if (body.status) {
    updateData.status = body.status;
    if (body.status === "graded") {
      updateData.graded_at = new Date().toISOString();
      updateData.graded_by = user.id;
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("submissions")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to grade submission:", updateError);
    return NextResponse.json(
      { error: "Failed to grade submission" },
      { status: 500 }
    );
  }

  return NextResponse.json({ submission: updated });
}
