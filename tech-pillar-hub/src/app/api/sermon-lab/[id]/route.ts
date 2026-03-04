import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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

  // RLS enforces access (user sees own, staff sees cohort)
  const { data: submission, error } = await supabase
    .from("sermon_submissions")
    .select("id, user_id, cohort_id, title, sermon_text, feedback, status, created_at")
    .eq("id", id)
    .single();

  if (error || !submission) {
    return NextResponse.json(
      { error: "Sermon submission not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ submission });
}
