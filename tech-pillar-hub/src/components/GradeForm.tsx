"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  currentGrade: number | null;
  currentFeedback: string | null;
  currentStatus: string;
  maxPoints: number | null;
};

export default function GradeForm({
  submissionId,
  currentGrade,
  currentFeedback,
  currentStatus,
  maxPoints,
}: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState(
    currentGrade != null ? String(currentGrade) : ""
  );
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrade(status: "graded" | "returned") {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/submissions/${submissionId}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: grade ? parseFloat(grade) : undefined,
          feedback: feedback || undefined,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save grade");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to save grade");
    } finally {
      setSaving(false);
    }
  }

  const isGraded = currentStatus === "graded";

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Grade{maxPoints != null ? ` (out of ${maxPoints})` : ""}
          </label>
          <input
            type="number"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="0"
            step="0.5"
            min="0"
            max={maxPoints ?? undefined}
            className="w-24 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Feedback
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Write feedback for the student..."
          rows={2}
          className="w-full border rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleGrade("graded")}
          disabled={saving}
          className="text-sm bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isGraded ? "Update Grade" : "Grade"}
        </button>
        <button
          onClick={() => handleGrade("returned")}
          disabled={saving}
          className="text-sm bg-orange-500 text-white rounded px-3 py-1.5 hover:bg-orange-600 disabled:opacity-50"
        >
          Return for Revision
        </button>
      </div>
    </div>
  );
}
