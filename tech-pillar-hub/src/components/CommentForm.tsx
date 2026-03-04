"use client";

import { useState } from "react";

type Comment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
};

type Props = {
  assignmentId: string;
  parentId?: string;
  onSubmit: (comment: Comment) => void;
  onCancel?: () => void;
};

export default function CommentForm({
  assignmentId,
  parentId,
  onSubmit,
  onCancel,
}: Props) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost() {
    if (!body.trim()) return;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          parentId,
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to post comment");
        return;
      }

      const data = await res.json();
      onSubmit(data.comment);
      setBody("");
    } catch {
      setError("Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply..." : "Write a comment..."}
        rows={parentId ? 2 : 3}
        className="w-full border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handlePost}
          disabled={posting || !body.trim()}
          className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {posting ? "Posting..." : parentId ? "Reply" : "Post Comment"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
