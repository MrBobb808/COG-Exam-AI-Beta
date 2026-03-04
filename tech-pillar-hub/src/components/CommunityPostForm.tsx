"use client";

import { useState } from "react";

type Props = {
  cohortId: string;
  onCreated: (post: Record<string, unknown>) => void;
};

export default function CommunityPostForm({ cohortId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      });

      if (res.ok) {
        const post = await res.json();
        onCreated(post);
        setTitle("");
        setBody("");
        setExpanded(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-left border rounded-lg p-4 text-sm text-gray-400 hover:border-blue-300 hover:text-gray-600 transition-colors"
      >
        What&apos;s on your mind? Start a discussion...
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something with your cohort..."
        rows={4}
        className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setTitle("");
            setBody("");
          }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!body.trim() || loading}
          className="text-sm bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
