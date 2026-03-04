"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  profile: {
    display_name: string | null;
    bio: string | null;
    ministry: string | null;
    cohort_year: string | null;
    avatar_url: string | null;
  };
  userId: string;
};

export default function ProfileForm({ profile, userId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [ministry, setMinistry] = useState(profile.ministry ?? "");
  const [cohortYear, setCohortYear] = useState(profile.cohort_year ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAvatarUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar must be under 2 MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        setError("Failed to upload avatar");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      setAvatarUrl(publicUrl);
    } catch {
      setError("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || undefined,
          bio: bio || undefined,
          ministry: ministry || undefined,
          cohortYear: cohortYear || undefined,
          avatarUrl: avatarUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save profile");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 rounded p-2">
          Profile saved!
        </p>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center justify-center text-xl">
            {(displayName || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm border rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Change avatar"}
          </button>
          <p className="text-xs text-gray-400 mt-1">Max 2 MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
            }}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ministry</label>
          <input
            type="text"
            value={ministry}
            onChange={(e) => setMinistry(e.target.value)}
            placeholder="e.g. Youth Ministry, Music Ministry"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cohort Year</label>
          <input
            type="text"
            value={cohortYear}
            onChange={(e) => setCohortYear(e.target.value)}
            placeholder="e.g. 2025, Spring 2025"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}
