"use client";

import { useState } from "react";
import CommentForm from "./CommentForm";
import ReactionBar from "./ReactionBar";

type ReactionData = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  reactions: ReactionData[];
};

type Props = {
  assignmentId: string;
  initialComments: Comment[];
  currentUserId: string;
  isStaff: boolean;
};

function InlineAvatar({
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

export default function DiscussionThread({
  assignmentId,
  initialComments,
  currentUserId,
  isStaff,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of comments.filter((c) => c.parent_id !== null)) {
    const list = repliesByParent.get(c.parent_id!) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_id!, list);
  }

  function handleNewComment(comment: Omit<Comment, "reactions">) {
    setComments((prev) => [...prev, { ...comment, reactions: [] }]);
    setReplyingTo(null);
  }

  async function handleReactionToggle(discussionId: string, emoji: string) {
    await fetch(`/api/discussions/${discussionId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/discussions/${commentId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      // Remove the comment and its replies
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parent_id !== commentId)
      );
    }
  }

  return (
    <div className="space-y-4">
      <CommentForm
        assignmentId={assignmentId}
        onSubmit={handleNewComment}
      />

      {topLevel.length === 0 && (
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}

      {topLevel.map((comment) => {
        const replies = repliesByParent.get(comment.id) ?? [];
        const canDelete =
          comment.user_id === currentUserId || isStaff;

        return (
          <div key={comment.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <InlineAvatar profile={comment.profile} />
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
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
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
                      <InlineAvatar profile={reply.profile} />
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
                        onClick={() => handleDelete(reply.id)}
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
              <div className="ml-6">
                <CommentForm
                  assignmentId={assignmentId}
                  parentId={comment.id}
                  onSubmit={handleNewComment}
                  onCancel={() => setReplyingTo(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
