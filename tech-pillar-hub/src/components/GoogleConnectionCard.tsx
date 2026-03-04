"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  connection: {
    id: string;
    google_email: string;
    is_valid: boolean;
  } | null;
};

export default function GoogleConnectionCard({ connection }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (params.get("gc_connected") === "true") {
      setFlash({ type: "success", message: "Google Classroom connected successfully." });
      window.history.replaceState({}, "", "/app");
    } else if (params.get("gc_error")) {
      const err = params.get("gc_error");
      const messages: Record<string, string> = {
        no_refresh_token: "Google did not return a refresh token. Try disconnecting and reconnecting.",
        db_error: "Failed to save connection. Please try again.",
        token_exchange_failed: "Failed to exchange token with Google. Please try again.",
      };
      setFlash({ type: "error", message: messages[err!] || `OAuth error: ${err}` });
      window.history.replaceState({}, "", "/app");
    }
  }, [params]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setFlash({ type: "error", message: data.error || "Failed to disconnect" });
        return;
      }
      router.refresh();
    } catch {
      setFlash({ type: "error", message: "Network error" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Google Classroom</h2>

      {flash && (
        <div
          className={`rounded p-3 text-sm ${
            flash.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{flash.message}</span>
            <button
              className="ml-2 text-xs opacity-60 hover:opacity-100"
              onClick={() => setFlash(null)}
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        {!connection && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Google Classroom is not connected.</p>
            <a
              href="/api/google/auth/start"
              className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            >
              Connect
            </a>
          </div>
        )}

        {connection && !connection.is_valid && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600">
              Connection expired for {connection.google_email}. Please reconnect.
            </p>
            <a
              href="/api/google/auth/start"
              className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
            >
              Reconnect
            </a>
          </div>
        )}

        {connection && connection.is_valid && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm">
                Connected as <span className="font-medium">{connection.google_email}</span>
              </p>
            </div>
            <button
              className="border rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
