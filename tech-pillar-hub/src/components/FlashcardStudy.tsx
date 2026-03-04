"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FlashcardForm from "./FlashcardForm";

type Flashcard = {
  id: string;
  front: string;
  back: string;
  source: string;
  review: {
    rating: string;
    interval_days: number;
    next_review_at: string;
  } | null;
};

type Props = {
  cards: Flashcard[];
  moduleTitle: string;
  cohortId: string;
  moduleId: string;
  isStaff: boolean;
};

export default function FlashcardStudy({
  cards: initialCards,
  moduleTitle,
  cohortId,
  moduleId,
  isStaff,
}: Props) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  // Sort cards: due first, then new (no review), then not-due
  const now = new Date();
  const sortedCards = [...cards].sort((a, b) => {
    const aIsDue = a.review && new Date(a.review.next_review_at) <= now;
    const bIsDue = b.review && new Date(b.review.next_review_at) <= now;
    const aIsNew = !a.review;
    const bIsNew = !b.review;

    if (aIsDue && !bIsDue) return -1;
    if (!aIsDue && bIsDue) return 1;
    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    return 0;
  });

  const dueCount = sortedCards.filter(
    (c) => c.review && new Date(c.review.next_review_at) <= now
  ).length;
  const newCount = sortedCards.filter((c) => !c.review).length;

  const currentCard = sortedCards[currentIndex];

  async function handleRate(rating: "again" | "hard" | "easy") {
    if (!currentCard || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcardId: currentCard.id,
          rating,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update the card's review in state
        setCards((prev) =>
          prev.map((c) =>
            c.id === currentCard.id
              ? { ...c, review: data.review }
              : c
          )
        );
      }
    } catch {
      // Continue even if save fails
    } finally {
      setLoading(false);
      setReviewed((prev) => prev + 1);
      setIsFlipped(false);

      // Move to next card or finish
      if (currentIndex + 1 >= sortedCards.length) {
        setSessionComplete(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }
  }

  function handleNewCards(newCards: { id: string; front: string; back: string; source: string; created_at: string }[]) {
    setCards((prev) => [
      ...prev,
      ...newCards.map((c) => ({ ...c, review: null })),
    ]);
    router.refresh();
  }

  if (sortedCards.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 space-y-3">
          <div className="text-4xl">🃏</div>
          <p className="text-gray-500">No flashcards yet for this module.</p>
          {isStaff && (
            <p className="text-sm text-gray-400">
              Create cards manually or generate them with AI below.
            </p>
          )}
        </div>
        {isStaff && (
          <FlashcardForm moduleId={moduleId} onCreated={handleNewCards} />
        )}
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 space-y-3">
          <div className="text-4xl">🎉</div>
          <h2 className="text-lg font-medium">Session Complete!</h2>
          <p className="text-sm text-gray-500">
            You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""} in {moduleTitle}.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setSessionComplete(false);
                setReviewed(0);
                setIsFlipped(false);
              }}
              className="text-sm bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 transition-colors"
            >
              Study Again
            </button>
            <a
              href={`/app/courses/${cohortId}/games`}
              className="text-sm border rounded px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Back to Games
            </a>
          </div>
        </div>
        {isStaff && (
          <FlashcardForm moduleId={moduleId} onCreated={handleNewCards} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Card {currentIndex + 1} of {sortedCards.length}
        </span>
        <span>
          {dueCount > 0 && (
            <span className="text-orange-600 mr-3">{dueCount} due</span>
          )}
          {newCount > 0 && (
            <span className="text-blue-600">{newCount} new</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all"
          style={{
            width: `${((currentIndex) / sortedCards.length) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <div
        onClick={() => !isFlipped && setIsFlipped(true)}
        className={`min-h-[200px] border-2 rounded-xl p-6 flex items-center justify-center text-center transition-all ${
          isFlipped
            ? "border-green-300 bg-green-50"
            : "border-blue-300 bg-blue-50 cursor-pointer hover:border-blue-400"
        }`}
      >
        <div className="space-y-3">
          {!isFlipped ? (
            <>
              <p className="text-xs text-blue-500 font-medium uppercase">
                Question
              </p>
              <p className="text-lg">{currentCard.front}</p>
              <p className="text-xs text-gray-400 mt-4">
                Tap to reveal answer
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-green-600 font-medium uppercase">
                Answer
              </p>
              <p className="text-lg">{currentCard.back}</p>
            </>
          )}
        </div>
      </div>

      {/* Rating buttons — only shown after flip */}
      {isFlipped && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => handleRate("again")}
            disabled={loading}
            className="flex-1 max-w-[120px] bg-red-100 text-red-700 rounded-lg py-3 text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            Again
            <span className="block text-xs text-red-500 mt-0.5">1 day</span>
          </button>
          <button
            onClick={() => handleRate("hard")}
            disabled={loading}
            className="flex-1 max-w-[120px] bg-orange-100 text-orange-700 rounded-lg py-3 text-sm font-medium hover:bg-orange-200 disabled:opacity-50 transition-colors"
          >
            Hard
            <span className="block text-xs text-orange-500 mt-0.5">
              {currentCard.review
                ? `${(currentCard.review.interval_days || 1) + 1}d`
                : "2d"}
            </span>
          </button>
          <button
            onClick={() => handleRate("easy")}
            disabled={loading}
            className="flex-1 max-w-[120px] bg-green-100 text-green-700 rounded-lg py-3 text-sm font-medium hover:bg-green-200 disabled:opacity-50 transition-colors"
          >
            Easy
            <span className="block text-xs text-green-500 mt-0.5">
              {currentCard.review
                ? `${Math.round((currentCard.review.interval_days || 1) * 2.5)}d`
                : "4d"}
            </span>
          </button>
        </div>
      )}

      {/* Staff tools */}
      {isStaff && (
        <div className="border-t pt-4">
          <FlashcardForm moduleId={moduleId} onCreated={handleNewCards} />
        </div>
      )}
    </div>
  );
}
