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
  initialSubmissions: SermonSubmission[];
};

export default function SermonHistoryList({ initialSubmissions }: Props) {
  const [submissions] = useState(initialSubmissions);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (submissions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Past Submissions</h2>
      {submissions.map((s) => {
        const isExpanded = expandedId === s.id;
        const rating = s.feedback?.engagement_rating ?? null;

        return (
          <div key={s.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : s.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium truncate">{s.title}</span>
                {s.status === "completed" && rating != null && (
                  <span className="shrink-0 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {rating}/10
                  </span>
                )}
                {s.status === "analyzing" && (
                  <span className="shrink-0 text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    Analyzing...
                  </span>
                )}
                {s.status === "error" && (
                  <span className="shrink-0 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Error
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="text-gray-400">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isExpanded && s.feedback && (
              <div className="px-4 pb-4 border-t">
                <div className="pt-4">
                  <SermonFeedback feedback={s.feedback} />
                </div>
              </div>
            )}

            {isExpanded && s.status === "error" && (
              <div className="px-4 pb-4 border-t">
                <p className="text-sm text-red-600 pt-4">
                  Analysis failed. Please try submitting again.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
