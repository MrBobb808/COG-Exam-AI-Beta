import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import CommunityFeed from "@/components/CommunityFeed";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function CommunityPage({ params }: Props) {
  const { cohortId } = await params;
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

  // Fetch cohort name
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("name")
    .eq("id", cohortId)
    .single();

  if (!cohort) {
    notFound();
  }

  const admin = supabaseAdmin();
  const limit = 20;

  // Fetch initial posts — pinned first, then newest
  const { data: posts } = await admin
    .from("community_posts")
    .select("id, cohort_id, user_id, title, body, pinned, created_at, updated_at")
    .eq("cohort_id", cohortId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, limit - 1);

  const postList = posts ?? [];

  // Fetch profiles
  const authorIds = [...new Set(postList.map((p) => p.user_id))];
  const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();

  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", authorIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  // Comment counts and reactions
  const postIds = postList.map((p) => p.id);
  const commentCounts = new Map<string, number>();
  const reactionsByPost = new Map<string, { emoji: string; count: number; reacted: boolean }[]>();

  if (postIds.length > 0) {
    const [{ data: comments }, { data: reactions }] = await Promise.all([
      admin.from("community_comments").select("post_id").in("post_id", postIds),
      admin.from("community_reactions").select("post_id, user_id, emoji").in("post_id", postIds),
    ]);

    for (const c of comments ?? []) {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
    }

    for (const r of reactions ?? []) {
      if (!r.post_id) continue;
      const list = reactionsByPost.get(r.post_id) ?? [];
      const existing = list.find((e) => e.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user!.id) existing.reacted = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reacted: r.user_id === user!.id });
      }
      reactionsByPost.set(r.post_id, list);
    }
  }

  const enrichedPosts = postList.map((p) => ({
    ...p,
    profile: profileMap.get(p.user_id) ?? null,
    commentCount: commentCounts.get(p.id) ?? 0,
    reactions: reactionsByPost.get(p.id) ?? [],
  }));

  // Check hasMore
  const { count } = await admin
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId);

  const hasMore = limit < (count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/courses/${cohortId}`} className="text-sm text-text-secondary hover:text-navy transition-colors inline-flex items-center gap-1 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to {cohort.name}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Community</h1>
        <p className="text-sm text-text-secondary mt-1">{cohort.name} · {(count ?? 0)} posts</p>
      </div>

      <CommunityFeed
        cohortId={cohortId}
        initialPosts={enrichedPosts}
        initialHasMore={hasMore}
      />
    </div>
  );
}
