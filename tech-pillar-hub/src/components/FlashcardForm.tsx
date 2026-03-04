"use client";

import { useState } from "react";

type Flashcard = {
  id: string;
  front: string;
  back: string;
  source: string;
  created_at: string;
};

type Props = {
  moduleId: string;
  onCreated: (cards: Flashcard[]) => void;
};

export default function FlashcardForm({ moduleId, onCreated }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, front: front.trim(), back: back.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create card");

      onCreated([data.flashcard]);
      setFront("");
      setBack("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate cards");

      onCreated(data.flashcards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Card"}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm bg-purple-600 text-white rounded px-3 py-1.5 hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "✨ Generate with AI"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
          {error}
        </div>
      )}

      {generating && (
        <div className="text-center py-4 space-y-2">
          <div className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">
            AI is generating flashcards from module content...
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              Front (Question/Concept)
            </label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What is..."
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Back (Answer/Explanation)
            </label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="The answer is..."
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !front.trim() || !back.trim()}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create Card"}
          </button>
        </form>
      )}
    </div>
  );
}
