"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import AIChatPanel from "./AIChatPanel";

type Props = {
  children: React.ReactNode;
  isAdmin: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  userEmail: string;
};

export default function AppShell({
  children,
  isAdmin,
  displayName,
  avatarUrl,
  userEmail,
}: Props) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left sidebar */}
      <Sidebar
        isAdmin={isAdmin}
        displayName={displayName}
        avatarUrl={avatarUrl}
        userEmail={userEmail}
      />

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <TopHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          userEmail={userEmail}
          onToggleAI={() => setAiOpen(!aiOpen)}
          aiOpen={aiOpen}
        />

        {/* Content + AI panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-8 py-7 max-w-5xl">
              {children}
            </div>
          </main>

          {/* AI Chat Panel */}
          <AIChatPanel open={aiOpen} onClose={() => setAiOpen(false)} />
        </div>
      </div>
    </div>
  );
}
