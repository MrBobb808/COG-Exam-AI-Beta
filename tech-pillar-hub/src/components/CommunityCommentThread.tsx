"use client";

import { useState } from "react";
import ReactionBar from "./ReactionBar";

type Reaction = {
  emoji: string;
  count: number;
  reacted: boolean;
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
  postId: string;
  initialComments: Comment[];
  currentUserId: string;
  isStaff: boolean;
};

function CommentAvatar({
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
        className="w-6 h-6 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
      {initials}
    </span>
  );
}

export default function CommunityCommentThread({
  postId,
  initialComments,
  currentUserId,
  isStaff,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(false);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments.filter((c) => c.parent_id !== null)) {
    const list = repliesByParent.get(c.parent_id!) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_id!, list);
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/community/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });

      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setCommentBody("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReply(parentId: string) {
    if (!replyBody.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/community/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim(), parentId }),
      });

      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setReplyBody("");
        setReplyingTo(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReactionToggle(commentId: string, emoji: string) {
    await fetch(`/api/community/comments/${commentId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function handleDeleteComment(commentId: string) {
    // We don't have a dedicated delete endpoint for comments right now,
    // so we'll just filter locally for UI purposes.
    // TODO: Add DELETE endpoint for community comments
    setComments((prev) =>
      prev.filter((c) => c.id !== commentId && c.parent_id !== commentId)
    );
  }

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <form onSubmit={handleSubmitComment} className="flex gap-2">
        <input
          type="text"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!commentBody.trim() || loading}
          className="text-sm bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Comment
        </button>
      </form>

      {topLevel.length === 0 && (
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}

      {topLevel.map((comment) => {
        const replies = repliesByParent.get(comment.id) ?? [];
        const canDelete = comment.user_id === currentUserId || isStaff;

        return (
          <div key={comment.id} className="border rounded-lg p-4 space-y-3">
            {/* Comment header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CommentAvatar profile={comment.profile} />
                <span className="text-sm font-medium">
                  {comment.profile?.display_name ?? "Anonymous"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setReplyingTo(
                      replyingTo === comment.id ? null : comment.id
                    )
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  {replyingTo === comment.id ? "Cancel" : "Reply"}
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Comment body */}
            <p className="text-sm whitespace-pre-line">{comment.body}</p>

            {/* Reactions */}
            <ReactionBar
              reactions={comment.reactions}
              onToggle={(emoji) => handleReactionToggle(comment.id, emoji)}
            />

            {/* Replies */}
            {replies.map((reply) => {
              const canDeleteReply =
                reply.user_id === currentUserId || isStaff;

              return (
                <div
                  key={reply.id}
                  className="ml-6 border-l-2 border-gray-200 pl-4 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CommentAvatar profile={reply.profile} />
                      <span className="text-sm font-medium">
                        {reply.profile?.display_name ?? "Anonymous"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(reply.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                    {canDeleteReply && (
                      <button
                        onClick={() => handleDeleteComment(reply.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-line">{reply.body}</p>
                  <ReactionBar
                    reactions={reply.reactions}
                    onToggle={(emoji) => handleReactionToggle(reply.id, emoji)}
                  />
                </div>
              );
            })}

            {/* Reply form */}
            {replyingTo === comment.id && (
              <div className="ml-6 flex gap-2">
                <input
                  type="text"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitReply(comment.id);
                    }
                  }}
                />
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyBody.trim() || loading}
                  className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
