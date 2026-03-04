"use client";

import { useState } from "react";

const EMOJI_OPTIONS = ["👍", "❤️", "🙏", "💡", "🎉"] as const;

type Reaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type Props = {
  reactions: Reaction[];
  onToggle: (emoji: string) => Promise<void>;
};

export default function ReactionBar({ reactions, onToggle }: Props) {
  const [localReactions, setLocalReactions] = useState<Reaction[]>(reactions);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle(emoji: string) {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    setLocalReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          // Remove reaction
          const newCount = existing.count - 1;
          return newCount <= 0
            ? prev.filter((r) => r.emoji !== emoji)
            : prev.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: newCount, reacted: false }
                  : r
              );
        } else {
          // Add reaction
          return prev.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, reacted: true }
              : r
          );
        }
      } else {
        // New reaction
        return [...prev, { emoji, count: 1, reacted: true }];
      }
    });

    setShowPicker(false);

    try {
      await onToggle(emoji);
    } catch {
      // Revert on error
      setLocalReactions(reactions);
    } finally {
      setLoading(false);
    }
  }

  const activeReactions = localReactions.filter((r) => r.count > 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {activeReactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji)}
          className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
            r.reacted
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-gray-400 hover:text-gray-600 rounded-full border border-dashed border-gray-300 w-6 h-6 flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Add reaction"
        >
          +
        </button>

        {showPicker && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPicker(false)}
            />
            {/* Picker */}
            <div className="absolute bottom-full mb-1 left-0 bg-white border rounded-lg shadow-lg p-1.5 flex gap-1 z-20">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggle(emoji)}
                  className="text-lg hover:bg-gray-100 rounded p-1 transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
