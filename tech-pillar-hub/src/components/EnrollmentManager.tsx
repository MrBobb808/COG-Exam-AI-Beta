"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  email?: string;
};

type Props = {
  cohortId: string;
  members: Member[];
};

export default function EnrollmentManager({ cohortId, members }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAdd() {
    if (!email.trim()) return;

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to add student");
        return;
      }

      setSuccess(`Added ${data.member.email ?? email}`);
      setEmail("");
      router.refresh();
    } catch {
      setError("Failed to add student");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to remove student");
        return;
      }

      setSuccess("Student removed");
      router.refresh();
    } catch {
      setError("Failed to remove student");
    } finally {
      setRemoving(null);
    }
  }

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    instructor: "bg-blue-100 text-blue-700",
    student: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 rounded p-2">
          {success}
        </p>
      )}

      {/* Add student form */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !email.trim()}
          className="text-sm bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Student"}
        </button>
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between border rounded-lg px-4 py-2"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm">{m.email ?? m.user_id}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[m.role] ?? roleColors.student}`}
              >
                {m.role}
              </span>
            </div>
            {m.role !== "admin" && (
              <button
                onClick={() => handleRemove(m.id)}
                disabled={removing === m.id}
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                {removing === m.id ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-gray-400">No members yet.</p>
        )}
      </div>
    </div>
  );
}
