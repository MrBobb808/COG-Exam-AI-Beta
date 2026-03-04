"use client";

import { useState } from "react";

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

type Props = {
  announcements: Announcement[];
};

export default function AnnouncementsList({ announcements }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? announcements : announcements.slice(0, 3);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Announcements</h2>
      <div className="space-y-2">
        {visible.map((a) => (
          <div
            key={a.id}
            className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
          >
            <p className="font-medium text-sm">{a.title}</p>
            {a.body && a.body !== a.title && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">
                {a.body}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {announcements.length > 3 && (
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? "Show less"
            : `Show ${announcements.length - 3} more`}
        </button>
      )}
    </section>
  );
}
