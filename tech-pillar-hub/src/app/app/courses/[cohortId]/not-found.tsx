import Link from "next/link";

export default function CohortNotFound() {
  return (
    <div className="space-y-4 text-center py-12">
      <h1 className="text-xl font-semibold">Course not found</h1>
      <p className="text-sm text-gray-500">
        This course does not exist or you do not have access.
      </p>
      <Link
        href="/app/courses"
        className="text-sm text-blue-600 hover:underline"
      >
        &larr; Back to courses
      </Link>
    </div>
  );
}
