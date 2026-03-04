import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import CommunityPostDetail from "./CommunityPostDetail";

type Props = {
  params: Promise<{ cohortId: string; postId: string }>;
};

export default async function CommunityPostPage({ params }: Props) {
  const { cohortId, postId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const isStaff =
    membership.role === "admin" || membership.role === "instructor";

  const admin = supabaseAdmin();

  // Fetch post
  const { data: post } = await admin
    .from("community_posts")
    .select("id, cohort_id, user_id, title, body, pinned, created_at, updated_at")
    .eq("id", postId)
    .eq("cohort_id", cohortId)
    .single();

  if (!post) {
    notFound();
  }

  // Fetch cohort name
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("name")
    .eq("id", cohortId)
    .single();

  // Fetch comments
  const { data: comments } = await admin
    .from("community_comments")
    .select("id, post_id, user_id, parent_id, body, created_at, updated_at")
    .eq("post_id", postId)
    .order("created_at");

  // Gather all user IDs
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
      if (r.user_id === user!.id) existing.reacted = true;
    } else {
      postReactionGroups.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user!.id });
    }
  }

  // Comment reactions
  const commentIds = (comments ?? []).map((c) => c.id);
  const commentReactionsMap = new Map<string, { emoji: string; count: number; reacted: boolean }[]>();

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
        if (r.user_id === user!.id) existing.reacted = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user!.id });
      }
      commentReactionsMap.set(r.comment_id, list);
    }
  }

  const enrichedPost = {
    ...post,
    profile: profileMap.get(post.user_id) ?? null,
    reactions: postReactionGroups,
  };

  const enrichedComments = (comments ?? []).map((c) => ({
    ...c,
    profile: profileMap.get(c.user_id) ?? null,
    reactions: commentReactionsMap.get(c.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/courses/${cohortId}/community`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Community
        </Link>
      </div>

      <CommunityPostDetail
        post={enrichedPost}
        comments={enrichedComments}
        currentUserId={user!.id}
        isStaff={isStaff}
        cohortId={cohortId}
        cohortName={cohort?.name ?? "Course"}
      />
    </div>
  );
}
