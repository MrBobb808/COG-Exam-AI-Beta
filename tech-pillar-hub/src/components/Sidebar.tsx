"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// ─── Icons (HeroIcons v2 Solid) ──────────────────────────────────────────────
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </svg>
  );
}

function ModulesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.687 5.25 1.822V4.533ZM12.75 20.572A8.25 8.25 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.039Z" />
    </svg>
  );
}

function SermonLabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
    </svg>
  );
}

function LiveSessionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
    </svg>
  );
}

function ResourcesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M12 1.5a.75.75 0 0 1 .75.75V4.5a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 12 1.5ZM5.636 4.136a.75.75 0 0 1 1.06 0l1.592 1.591a.75.75 0 0 1-1.061 1.06l-1.591-1.59a.75.75 0 0 1 0-1.061Zm12.728 0a.75.75 0 0 1 0 1.06l-1.591 1.592a.75.75 0 1 1-1.06-1.061l1.59-1.591a.75.75 0 0 1 1.061 0Zm-6.816 4.496a.75.75 0 0 1 .82.311l5.228 7.917a.75.75 0 0 1-.777 1.148l-2.097-.43 1.045 3.9a.75.75 0 0 1-1.45.388l-1.044-3.899-1.601 1.42a.75.75 0 0 1-1.247-.606l.569-9.47a.75.75 0 0 1 .554-.68ZM3 10.5a.75.75 0 0 1 .75-.75H6a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10.5Zm14.25 0a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H18a.75.75 0 0 1-.75-.75Zm-8.962 3.712a.75.75 0 0 1 0 1.061l-1.591 1.591a.75.75 0 1 1-1.061-1.06l1.591-1.592a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────────────
type NavItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
};

function NavItem({ href, label, icon, active, collapsed }: NavItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150 select-none
        ${active
          ? "bg-white/15 text-white shadow-sm"
          : "text-white/60 hover:text-white hover:bg-white/10"
        }
        ${collapsed ? "justify-center" : ""}
      `}
    >
      {icon}
      {!collapsed && <span className="truncate leading-none">{label}</span>}
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />
      )}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <span className="
          absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-navy-dark text-white text-xs
          whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none
          transition-opacity duration-150 z-50 border border-white/10 shadow-lg
        ">
          {label}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
type SidebarProps = {
  isAdmin: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  userEmail: string;
};

export default function Sidebar({
  isAdmin,
  displayName,
  avatarUrl,
  userEmail,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const name = displayName ?? userEmail.split("@")[0] ?? "User";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={`
        ${collapsed ? "w-[68px]" : "w-64"} shrink-0
        bg-navy flex flex-col h-screen sticky top-0
        transition-all duration-200 ease-in-out overflow-hidden
      `}
    >
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div
        className={`
          flex items-center h-16 px-3 border-b border-white/10 gap-3
          ${collapsed ? "justify-center" : ""}
        `}
      >
        <div className="w-9 h-9 bg-crimson rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-white font-bold text-sm">TP</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              Tech Pillar
            </p>
            <p className="text-white/40 text-[10px] truncate">School of Preaching</p>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto sidebar-scroll">
        <NavItem
          href="/app/dashboard"
          label="Dashboard"
          icon={<DashboardIcon />}
          active={isActive("/app/dashboard")}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/courses"
          label="Modules"
          icon={<ModulesIcon />}
          active={isActive("/app/courses")}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/games"
          label="Sermon Lab"
          icon={<SermonLabIcon />}
          active={pathname === "/app/games" || pathname.startsWith("/app/games/")}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/community"
          label="Community"
          icon={<CommunityIcon />}
          active={pathname === "/app/community" || pathname.startsWith("/app/community/")}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/leaderboard"
          label="Live Sessions"
          icon={<LiveSessionsIcon />}
          active={isActive("/app/leaderboard")}
          collapsed={collapsed}
        />

        {/* Divider */}
        <div className={`my-3 h-px bg-white/10 ${collapsed ? "mx-1" : "mx-1"}`} />

        <NavItem
          href="/app/community"
          label="Resources"
          icon={<ResourcesIcon />}
          active={false}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/leaderboard"
          label="Progress"
          icon={<ProgressIcon />}
          active={false}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/profile"
          label="Settings"
          icon={<SettingsIcon />}
          active={isActive("/app/profile")}
          collapsed={collapsed}
        />

        {isAdmin && (
          <>
            <div className={`my-3 h-px bg-white/10 ${collapsed ? "mx-1" : "mx-1"}`} />
            <NavItem
              href="/app"
              label="Admin Panel"
              icon={<AdminIcon />}
              active={pathname === "/app"}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* ── User Section ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 p-2.5 space-y-1">
        <Link
          href="/app/profile"
          title={collapsed ? name : undefined}
          className={`
            group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
            transition-colors duration-150 select-none
            ${pathname === "/app/profile"
              ? "bg-white/10 text-white"
              : "text-white/60 hover:text-white hover:bg-white/10"
            }
            ${collapsed ? "justify-center" : ""}
          `}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-7 h-7 rounded-full object-cover shrink-0 ring-2 ring-white/20"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-crimson text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {name}
              </p>
              <p className="text-[10px] text-white/40 truncate">View profile</p>
            </div>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-navy-dark text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 border border-white/10 shadow-lg">
              {name}
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg
            text-white/40 hover:text-white/70 hover:bg-white/5
            transition-colors duration-150
            ${collapsed ? "justify-center" : ""}
          `}
        >
          {collapsed ? <ChevronRightIcon /> : (
            <>
              <ChevronLeftIcon />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
