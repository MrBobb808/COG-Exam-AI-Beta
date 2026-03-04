import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Fetch post
  const { data: post } = await admin
    .from("community_posts")
    .select("id, cohort_id, user_id, title, body, pinned, created_at, updated_at")
    .eq("id", postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id, role")
    .eq("cohort_id", post.cohort_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Fetch comments
  const { data: comments } = await admin
    .from("community_comments")
    .select("id, post_id, user_id, parent_id, body, created_at, updated_at")
    .eq("post_id", postId)
    .order("created_at");

  // Gather all user IDs (post author + comment authors)
  const allUserIds = [
    post.user_id,
    ...new Set((comments ?? []).map((c) => c.user_id)),
  ];

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", allUserIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }])
  );

  // Fetch reactions for post and comments
  const commentIds = (comments ?? []).map((c) => c.id);

  // Post reactions
  const { data: postReactions } = await admin
    .from("community_reactions")
    .select("user_id, emoji")
    .eq("post_id", postId);

  const postReactionGroups: { emoji: string; count: number; reacted: boolean }[] = [];
  for (const r of postReactions ?? []) {
    const existing = postReactionGroups.find((e) => e.emoji === r.emoji);
    if (existing) {
      existing.count++;
      if (r.user_id === user.id) existing.reacted = true;
    } else {
      postReactionGroups.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user.id });
    }
  }

  // Comment reactions
  let commentReactionsMap = new Map<string, { emoji: string; count: number; reacted: boolean }[]>();

  if (commentIds.length > 0) {
    const { data: commentReactions } = await admin
      .from("community_reactions")
      .select("comment_id, user_id, emoji")
      .in("comment_id", commentIds);

    for (const r of commentReactions ?? []) {
      if (!r.comment_id) continue;
      const list = commentReactionsMap.get(r.comment_id) ?? [];
      const existing = list.find((e) => e.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user.id) existing.reacted = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user.id });
      }
      commentReactionsMap.set(r.comment_id, list);
    }
  }

  const isStaff = membership.role === "admin" || membership.role === "instructor";

  return NextResponse.json({
    post: {
      ...post,
      profile: profileMap.get(post.user_id) ?? null,
      reactions: postReactionGroups,
    },
    comments: (comments ?? []).map((c) => ({
      ...c,
      profile: profileMap.get(c.user_id) ?? null,
      reactions: commentReactionsMap.get(c.id) ?? [],
    })),
    isStaff,
    currentUserId: user.id,
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: post } = await admin
    .from("community_posts")
    .select("id, cohort_id, user_id")
    .eq("id", postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Check: author or staff
  const isAuthor = post.user_id === user.id;

  if (!isAuthor) {
    const { data: membership } = await supabase
      .from("cohort_members")
      .select("role")
      .eq("cohort_id", post.cohort_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const isStaff = membership?.role === "admin" || membership?.role === "instructor";
    if (!isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await admin.from("community_posts").delete().eq("id", postId);

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: postId } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: post } = await admin
    .from("community_posts")
    .select("id, cohort_id, pinned")
    .eq("id", postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Only staff can pin/unpin
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", post.cohort_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const isStaff = membership?.role === "admin" || membership?.role === "instructor";
  if (!isStaff) {
    return NextResponse.json({ error: "Only staff can pin posts" }, { status: 403 });
  }

  const { data: updated } = await admin
    .from("community_posts")
    .update({ pinned: !post.pinned })
    .eq("id", postId)
    .select("id, pinned")
    .single();

  return NextResponse.json(updated);
}
