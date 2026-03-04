import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { body: string; parentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Fetch post to get cohort
  const { data: post } = await admin
    .from("community_posts")
    .select("id, cohort_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", post.cohort_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: comment, error } = await admin
    .from("community_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      parent_id: body.parentId || null,
      body: body.body.trim(),
    })
    .select("id, post_id, user_id, parent_id, body, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }

  // Fetch author profile
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(
    { ...comment, profile: profile ?? null, reactions: [] },
    { status: 201 }
  );
}
