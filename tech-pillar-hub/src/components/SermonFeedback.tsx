"use client";

type Feedback = {
  structure: string;
  theology: string;
  delivery: string;
  engagement: string;
  engagement_rating: number;
  summary: string;
};

type Props = {
  feedback: Feedback;
};

export default function SermonFeedback({ feedback }: Props) {
  const rating = Math.max(1, Math.min(10, feedback.engagement_rating || 5));

  const ratingColor =
    rating >= 8
      ? "text-green-600 bg-green-50"
      : rating >= 5
        ? "text-amber-600 bg-amber-50"
        : "text-red-600 bg-red-50";

  const sections = [
    { title: "📋 Structure", content: feedback.structure },
    { title: "📖 Theology", content: feedback.theology },
    { title: "🎤 Delivery", content: feedback.delivery },
    { title: "🎯 Engagement", content: feedback.engagement },
  ];

  return (
    <div className="space-y-4">
      {/* Summary + Rating */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-900 mb-1">Summary</p>
            <p className="text-sm text-blue-800">{feedback.summary}</p>
          </div>
          <div
            className={`shrink-0 rounded-lg px-3 py-2 text-center ${ratingColor}`}
          >
            <p className="text-2xl font-bold">{rating}</p>
            <p className="text-xs font-medium">/10</p>
          </div>
        </div>
      </div>

      {/* Detailed sections */}
      {sections.map((section) =>
        section.content ? (
          <div key={section.title} className="border rounded-lg p-4 space-y-1">
            <h3 className="text-sm font-medium">{section.title}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {section.content}
            </p>
          </div>
        ) : null
      )}
    </div>
  );
}
