import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

  const { data: submission } = await admin
    .from("submissions")
    .select(
      "id, assignment_id, user_id, content, file_url, status, grade, feedback, submitted_at, graded_at, created_at"
    )
    .eq("id", id)
    .single();

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 }
    );
  }

  // Verify access: must be owner or cohort staff
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

  const isOwner = submission.user_id === user.id;
  if (!isOwner) {
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

  // Generate signed URL for file if present
  let signedFileUrl: string | null = null;
  if (submission.file_url) {
    const { data: urlData } = await admin.storage
      .from("submissions")
      .createSignedUrl(submission.file_url, 3600);

    signedFileUrl = urlData?.signedUrl ?? null;
  }

  return NextResponse.json({
    submission: { ...submission, signedFileUrl },
  });
}
