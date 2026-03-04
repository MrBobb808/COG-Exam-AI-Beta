"use client";

import { useState } from "react";
import SermonLabForm from "@/components/SermonLabForm";
import SermonHistoryList from "@/components/SermonHistoryList";

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
  initialSubmissions: SermonSubmission[];
};

export default function SermonLabClient({
  cohortId,
  initialSubmissions,
}: Props) {
  const [submissions, setSubmissions] =
    useState<SermonSubmission[]>(initialSubmissions);

  function handleNewSubmission(submission: SermonSubmission) {
    setSubmissions((prev) => [submission, ...prev]);
  }

  return (
    <div className="space-y-8">
      <SermonLabForm cohortId={cohortId} onSubmit={handleNewSubmission} />

      <SermonHistoryList initialSubmissions={submissions} />
    </div>
  );
}
