"use client";

import { useState } from "react";
import SermonFeedback from "./SermonFeedback";

type SermonSubmission = {
  id: string;
  title: string;
  status: string;
  feedback: {
    structure: string;
    theology: string;
    delivery: string;
    engagement: string;
    engagement_rating: number;
    summary: string;
  } | null;
  created_at: string;
};

type Props = {
  cohortId: string;
  onSubmit: (submission: SermonSubmission) => void;
};

export default function SermonLabForm({ cohortId, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [sermonText, setSermonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<SermonSubmission | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !sermonText.trim() || loading) return;

    setLoading(true);
    setError(null);
    setLatestFeedback(null);

    try {
      const res = await fetch("/api/sermon-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          title: title.trim(),
          sermonText: sermonText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to analyze sermon");
      }

      const submission = data.submission as SermonSubmission;
      setLatestFeedback(submission);
      onSubmit(submission);
      setTitle("");
      setSermonText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="sermon-title"
            className="text-sm font-medium block mb-1"
          >
            Sermon Title
          </label>
          <input
            id="sermon-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Good Shepherd"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label
            htmlFor="sermon-text"
            className="text-sm font-medium block mb-1"
          >
            Sermon Text
          </label>
          <textarea
            id="sermon-text"
            value={sermonText}
            onChange={(e) => setSermonText(e.target.value)}
            placeholder="Paste or type your sermon here..."
            rows={12}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <p className="text-xs text-gray-400 mt-1">
            {sermonText.length} characters
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim() || !sermonText.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyzing your sermon..." : "Analyze Sermon"}
        </button>
      </form>

      {/* Show loading animation */}
      {loading && (
        <div className="text-center py-8 space-y-3">
          <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">
            AI is reading and analyzing your sermon...
          </p>
          <p className="text-xs text-gray-400">
            This usually takes 10-30 seconds
          </p>
        </div>
      )}

      {/* Latest feedback */}
      {latestFeedback?.feedback && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">
            Feedback: {latestFeedback.title}
          </h3>
          <SermonFeedback feedback={latestFeedback.feedback} />
        </div>
      )}
    </div>
  );
}
