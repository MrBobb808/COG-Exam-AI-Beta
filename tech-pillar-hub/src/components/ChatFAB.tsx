"use client";

import Link from "next/link";

type Props = {
  cohortId: string;
};

export default function ChatFAB({ cohortId }: Props) {
  return (
    <Link
      href={`/app/courses/${cohortId}/chat`}
      className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-50"
      title="Ask Tech Mentor"
    >
      <span className="text-2xl">🤖</span>
    </Link>
  );
}
