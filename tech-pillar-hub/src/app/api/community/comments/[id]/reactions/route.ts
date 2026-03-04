import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_EMOJIS = ["👍", "❤️", "🙏", "💡", "🎉"];

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: commentId } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { emoji: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emoji } = body;

  if (!emoji || !VALID_EMOJIS.includes(emoji)) {
    return NextResponse.json(
      { error: "Invalid emoji. Must be one of: 👍 ❤️ 🙏 💡 🎉" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Check if reaction already exists (toggle)
  const { data: existing } = await admin
    .from("community_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await admin.from("community_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed", emoji });
  } else {
    const { error: insertError } = await admin
      .from("community_reactions")
      .insert({
        user_id: user.id,
        comment_id: commentId,
        emoji,
      });

    if (insertError) {
      console.error("Failed to add reaction:", insertError);
      return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
    }

    return NextResponse.json({ action: "added", emoji }, { status: 201 });
  }
}
