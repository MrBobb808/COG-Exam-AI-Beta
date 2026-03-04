"use client";

import { useState, useCallback } from "react";
import CommunityPostForm from "./CommunityPostForm";
import CommunityPostCard from "./CommunityPostCard";

type Reaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type Post = {
  id: string;
  cohort_id: string;
  user_id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  commentCount: number;
  reactions: Reaction[];
};

type Props = {
  cohortId: string;
  initialPosts: Post[];
  initialHasMore: boolean;
};

export default function CommunityFeed({
  cohortId,
  initialPosts,
  initialHasMore,
}: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleNewPost(post: Record<string, unknown>) {
    setPosts((prev) => [post as unknown as Post, ...prev]);
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const res = await fetch(
        `/api/community?cohortId=${cohortId}&page=${nextPage}`
      );
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [...prev, ...data.posts]);
        setPage(nextPage);
        setHasMore(data.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const handleReactionToggle = useCallback(
    async (postId: string, emoji: string) => {
      // Optimistic update is handled by ReactionBar internally
      await fetch(`/api/community/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    },
    []
  );

  // Separate pinned and unpinned for display ordering
  const pinnedPosts = posts.filter((p) => p.pinned);
  const unpinnedPosts = posts.filter((p) => !p.pinned);

  return (
    <div className="space-y-4">
      <CommunityPostForm cohortId={cohortId} onCreated={handleNewPost} />

      {posts.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No posts yet. Be the first to start a conversation!
        </p>
      )}

      {/* Pinned posts */}
      {pinnedPosts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          onReactionToggle={handleReactionToggle}
        />
      ))}

      {/* Regular posts */}
      {unpinnedPosts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          onReactionToggle={handleReactionToggle}
        />
      ))}

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more posts"}
          </button>
        </div>
      )}
    </div>
  );
}
