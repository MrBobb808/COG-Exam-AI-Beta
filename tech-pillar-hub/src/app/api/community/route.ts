import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohortId");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;

  if (!cohortId) {
    return NextResponse.json({ error: "cohortId is required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const offset = (page - 1) * limit;

  // Fetch posts — pinned first, then newest
  const { data: posts, error } = await admin
    .from("community_posts")
    .select("id, cohort_id, user_id, title, body, pinned, created_at, updated_at")
    .eq("cohort_id", cohortId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  const postList = posts ?? [];

  // Fetch author profiles
  const authorIds = [...new Set(postList.map((p) => p.user_id))];
  let profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();

  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", authorIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  // Fetch comment counts per post
  const postIds = postList.map((p) => p.id);
  let commentCounts = new Map<string, number>();
  let reactionsByPost = new Map<string, { emoji: string; count: number; reacted: boolean }[]>();

  if (postIds.length > 0) {
    // Comment counts
    const { data: comments } = await admin
      .from("community_comments")
      .select("post_id")
      .in("post_id", postIds);

    for (const c of comments ?? []) {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
    }

    // Reactions on posts
    const { data: reactions } = await admin
      .from("community_reactions")
      .select("post_id, user_id, emoji")
      .in("post_id", postIds);

    for (const r of reactions ?? []) {
      if (!r.post_id) continue;
      const list = reactionsByPost.get(r.post_id) ?? [];
      const existing = list.find((e) => e.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user.id) existing.reacted = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user.id });
      }
      reactionsByPost.set(r.post_id, list);
    }
  }

  const enriched = postList.map((p) => ({
    ...p,
    profile: profileMap.get(p.user_id) ?? null,
    commentCount: commentCounts.get(p.id) ?? 0,
    reactions: reactionsByPost.get(p.id) ?? [],
  }));

  // Check if there are more posts
  const { count } = await admin
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId);

  return NextResponse.json({
    posts: enriched,
    page,
    hasMore: offset + limit < (count ?? 0),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { cohortId: string; title?: string; body: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cohortId, title, body: postBody } = body;

  if (!cohortId || !postBody?.trim()) {
    return NextResponse.json({ error: "cohortId and body are required" }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const admin = supabaseAdmin();

  const { data: post, error } = await admin
    .from("community_posts")
    .insert({
      cohort_id: cohortId,
      user_id: user.id,
      title: title?.trim() || null,
      body: postBody.trim(),
    })
    .select("id, cohort_id, user_id, title, body, pinned, created_at, updated_at")
    .single();

  if (error) {
    console.error("Failed to create community post:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }

  // Fetch author profile
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      ...post,
      profile: profile ?? null,
      commentCount: 0,
      reactions: [],
    },
    { status: 201 }
  );
}
