"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  userEmail?: string | null;
  onLogout: () => void;
  canManageKbSection?: boolean;
  canViewWebhooks?: boolean;
  canViewAuditLog?: boolean;
  onboardingProgress?: { stepsDone: string[]; isProfileComplete: boolean } | null;
}

const NAV_ITEMS: { path: string; label: string; requiresKb?: boolean; requiresWebhooks?: boolean; requiresAudit?: boolean }[] = [
  { path: "/overview", label: "Overview" },
  { path: "/conversations", label: "Conversations" },
  { path: "/tickets", label: "Tickets" },
  { path: "/knowledge", label: "Knowledge base", requiresKb: true },
  { path: "/routing", label: "Routing", requiresKb: true },
  { path: "/escalation", label: "Escalation", requiresKb: true },
  { path: "/canned", label: "Canned responses", requiresKb: true },
  { path: "/gaps", label: "Knowledge gaps", requiresKb: true },
  { path: "/webhooks", label: "Webhooks", requiresWebhooks: true },
  { path: "/audit", label: "Audit log", requiresAudit: true }
];

export function DashboardLayout({
  children,
  userEmail,
  onLogout,
  canManageKbSection = false,
  canViewWebhooks = false,
  canViewAuditLog = false,
  onboardingProgress = null
}: DashboardLayoutProps) {
  const pathname = usePathname();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.requiresWebhooks && !canViewWebhooks) return false;
    if (item.requiresAudit && !canViewAuditLog) return false;
    if (item.requiresKb && !canManageKbSection) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-slate-200 p-4">
            <Link href="/overview" className="block">
              <h1 className="text-lg font-semibold text-slate-900">Kleo - AI CLIENT SUCCESS AGENT</h1>
            </Link>
            <p className="text-xs text-slate-500">CS Dashboard</p>
            {onboardingProgress && !onboardingProgress.isProfileComplete ? (
              <p className="mt-1 text-xs text-sky-600">
                Setup: {onboardingProgress.stepsDone.length}/5 steps
              </p>
            ) : null}
          </div>
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Dashboard sections">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm focus:outline-none ${
                    isActive
                      ? "bg-slate-200 font-medium text-slate-900"
                      : "text-slate-700 hover:bg-slate-100 focus:bg-slate-100"
                  }`}
                  aria-label={`Go to ${item.label}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <p className="truncate text-xs text-slate-500" title={userEmail ?? undefined}>
              {userEmail ?? "—"}
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-200 focus:outline-none"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
