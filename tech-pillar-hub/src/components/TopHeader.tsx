"use client";

import { useState } from "react";

type Props = {
  displayName: string | null;
  avatarUrl: string | null;
  userEmail: string;
  onToggleAI?: () => void;
  aiOpen?: boolean;
};

export default function TopHeader({
  displayName,
  avatarUrl,
  userEmail,
  onToggleAI,
  aiOpen = false,
}: Props) {
  const [searchFocused, setSearchFocused] = useState(false);
  const name = displayName ?? userEmail.split("@")[0] ?? "User";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* Search bar */}
      <div className="flex-1 max-w-md">
        <div
          className={`
            relative flex items-center gap-2 rounded-lg border px-3 py-2
            transition-all duration-150
            ${searchFocused
              ? "border-navy bg-white shadow-sm"
              : "border-border bg-[#F5F7FA] hover:border-slate-300"
            }
          `}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-4 h-4 text-text-secondary shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search modules, sermons, discussions..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline text-[10px] font-medium text-text-secondary/50 bg-white border border-border rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* AI Study Companion toggle */}
        <button
          onClick={onToggleAI}
          title="AI Study Companion"
          className={`
            relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
            transition-all duration-150
            ${aiOpen
              ? "bg-crimson/10 text-crimson border border-crimson/20"
              : "text-text-secondary hover:text-navy hover:bg-navy/5 border border-transparent"
            }
          `}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5">
            <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
          </svg>
          <span className="hidden md:inline">AI Assistant</span>
        </button>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg text-text-secondary hover:text-navy hover:bg-navy/5 transition-colors"
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
          </svg>
          {/* Notification badge */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-crimson rounded-full" />
        </button>

        {/* User profile */}
        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-border">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-medium text-text-primary truncate leading-tight">
              {name}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
