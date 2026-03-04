"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactionBar from "@/components/ReactionBar";
import CommunityCommentThread from "@/components/CommunityCommentThread";

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
  reactions: Reaction[];
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  reactions: Reaction[];
};

type Props = {
  post: Post;
  comments: Comment[];
  currentUserId: string;
  isStaff: boolean;
  cohortId: string;
  cohortName: string;
};

function PostAvatar({
  profile,
}: {
  profile: { display_name: string | null; avatar_url: string | null } | null;
}) {
  const name = profile?.display_name ?? "?";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        className="w-10 h-10 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
      {initials}
    </span>
  );
}

export default function CommunityPostDetail({
  post,
  comments,
  currentUserId,
  isStaff,
  cohortId,
}: Props) {
  const router = useRouter();
  const [pinning, setPinning] = useState(false);
  const [isPinned, setIsPinned] = useState(post.pinned);

  async function handlePostReactionToggle(emoji: string) {
    await fetch(`/api/community/${post.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function handleTogglePin() {
    if (pinning) return;
    setPinning(true);

    try {
      const res = await fetch(`/api/community/${post.id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        setIsPinned(data.pinned);
      }
    } finally {
      setPinning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this post?")) return;

    const res = await fetch(`/api/community/${post.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push(`/app/courses/${cohortId}/community`);
    }
  }

  const canDelete = post.user_id === currentUserId || isStaff;

  return (
    <div className="space-y-6">
      {/* Post */}
      <div className="border rounded-lg p-6 space-y-4">
        {/* Author header */}
        <div className="flex items-start gap-3">
          <PostAvatar profile={post.profile} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {post.profile?.display_name ?? "Anonymous"}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {isPinned && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                  📌 Pinned
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isStaff && (
              <button
                onClick={handleTogglePin}
                disabled={pinning}
                className="text-xs text-gray-500 hover:text-gray-700 border rounded px-2 py-1"
              >
                {isPinned ? "Unpin" : "📌 Pin"}
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Title + Body */}
        {post.title && (
          <h1 className="text-lg font-semibold">{post.title}</h1>
        )}
        <p className="text-sm whitespace-pre-line">{post.body}</p>

        {/* Reactions */}
        <ReactionBar
          reactions={post.reactions}
          onToggle={handlePostReactionToggle}
        />
      </div>

      {/* Comments */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-600">
          Comments ({comments.length})
        </h2>
        <CommunityCommentThread
          postId={post.id}
          initialComments={comments}
          currentUserId={currentUserId}
          isStaff={isStaff}
        />
      </section>
    </div>
  );
}
