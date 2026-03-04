import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cohortId = request.nextUrl.searchParams.get("cohortId");

  if (!cohortId) {
    return NextResponse.json(
      { error: "Missing cohortId parameter" },
      { status: 400 }
    );
  }

  // RLS ensures user can only see their own messages
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, context, created_at")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Failed to fetch chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ messages: messages ?? [] });
}
