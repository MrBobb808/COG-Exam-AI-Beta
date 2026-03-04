"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  assignmentId: string;
  cohortId: string;
  existingSubmission: {
    id: string;
    content: string | null;
    file_url: string | null;
    status: string;
  } | null;
};

export default function SubmissionForm({
  assignmentId,
  cohortId,
  existingSubmission,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(existingSubmission?.content ?? "");
  const [fileUrl, setFileUrl] = useState(existingSubmission?.file_url ?? "");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocked =
    existingSubmission?.status === "submitted" ||
    existingSubmission?.status === "graded";

  if (isLocked) {
    return null; // SubmissionStatus handles the display
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("assignmentId", assignmentId);
    formData.append("cohortId", cohortId);

    try {
      const res = await fetch("/api/submissions/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Upload failed");
        return;
      }

      const data = await res.json();
      setFileUrl(data.fileUrl);
      setFileName(file.name);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(status: "draft" | "submitted") {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          content: content || undefined,
          fileUrl: fileUrl || undefined,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        return;
      }

      router.refresh();
    } catch {
      setError("Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Your response
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your submission here... You can include text, links, or notes."
          rows={6}
          className="w-full border rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Attach a file (optional)
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Choose file"}
          </button>
          <span className="text-sm text-gray-500">
            {fileName || (fileUrl ? "File attached" : "No file chosen")}
          </span>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Max 10 MB</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSubmit("draft")}
          disabled={submitting || (!content.trim() && !fileUrl)}
          className="text-sm border rounded px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={() => handleSubmit("submitted")}
          disabled={submitting || (!content.trim() && !fileUrl)}
          className="text-sm bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
