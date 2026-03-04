type Props = {
  submission: {
    status: string;
    grade: number | null;
    feedback: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    file_url: string | null;
  } | null;
  maxPoints: number | null;
};

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
  graded: { label: "Graded", color: "bg-green-100 text-green-700" },
  returned: {
    label: "Returned for revision",
    color: "bg-orange-100 text-orange-700",
  },
};

export default function SubmissionStatus({ submission, maxPoints }: Props) {
  if (!submission) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
          Not submitted
        </span>
      </div>
    );
  }

  const config = statusConfig[submission.status] ?? statusConfig.draft;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}`}
        >
          {config.label}
        </span>
        {submission.submitted_at && (
          <span className="text-xs text-gray-400">
            Submitted{" "}
            {new Date(submission.submitted_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {submission.grade != null && (
        <p className="text-sm font-medium">
          Grade: {submission.grade}
          {maxPoints != null ? ` / ${maxPoints}` : ""}
        </p>
      )}

      {submission.feedback && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Instructor Feedback
          </p>
          <p className="text-sm whitespace-pre-line">{submission.feedback}</p>
        </div>
      )}

      {submission.file_url && (
        <p className="text-xs text-gray-500">
          File attached: {submission.file_url.split("/").pop()}
        </p>
      )}
    </div>
  );
}
