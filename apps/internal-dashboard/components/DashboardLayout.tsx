"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  userEmail?: string | null;
  onLogout: () => void;
  canManageKbSection?: boolean;
  canViewWebhooks?: boolean;
  canViewAuditLog?: boolean;
  onboardingProgress?: { stepsDone: string[]; isProfileComplete: boolean } | null;
}

const NAV_ITEMS: {
  path: string;
  label: string;
  group: "operations" | "configure" | "governance";
  requiresKb?: boolean;
  requiresWebhooks?: boolean;
  requiresAudit?: boolean;
}[] = [
  { path: "/overview", label: "Overview", group: "operations" },
  { path: "/conversations", label: "Conversations", group: "operations" },
  { path: "/tickets", label: "Tickets", group: "operations" },
  { path: "/knowledge", label: "Knowledge Base", group: "configure", requiresKb: true },
  { path: "/routing", label: "Routing", group: "configure", requiresKb: true },
  { path: "/escalation", label: "Escalation", group: "configure", requiresKb: true },
  { path: "/canned", label: "Canned Responses", group: "configure", requiresKb: true },
  { path: "/gaps", label: "Knowledge Gaps", group: "configure", requiresKb: true },
  { path: "/webhooks", label: "Webhooks", group: "governance", requiresWebhooks: true },
  { path: "/audit", label: "Audit Log", group: "governance", requiresAudit: true }
];

const GROUP_LABELS: Record<(typeof NAV_ITEMS)[number]["group"], string> = {
  operations: "Operations",
  configure: "Configure",
  governance: "Governance"
};

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [liveEnabled, setLiveEnabled] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.requiresWebhooks && !canViewWebhooks) return false;
        if (item.requiresAudit && !canViewAuditLog) return false;
        if (item.requiresKb && !canManageKbSection) return false;
        return true;
      }),
    [canManageKbSection, canViewAuditLog, canViewWebhooks]
  );

  const grouped = useMemo(() => {
    const map = new Map<(typeof NAV_ITEMS)[number]["group"], typeof NAV_ITEMS>();
    for (const item of visibleNavItems) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [visibleNavItems]);

  return (
    <div className={`db-shell ${collapsed ? "db-shell-collapsed" : ""}`}>
      <aside className={`db-sidebar ${collapsed ? "db-sidebar-collapsed" : ""}`}>
        <div className="db-sidebar-inner">
          <div className="db-brand">
            <h1 className="db-brand-title">{collapsed ? "K" : "Kleo AI"}</h1>
            {!collapsed ? <p className="db-brand-sub">Client Success Dashboard</p> : null}
            {!collapsed && onboardingProgress && !onboardingProgress.isProfileComplete ? (
              <p className="db-brand-sub">Setup {onboardingProgress.stepsDone.length}/5</p>
            ) : null}
            <button
              type="button"
              className="db-btn db-btn-secondary"
              onClick={() => setCollapsed((value) => !value)}
              style={{ marginTop: "0.55rem", width: "100%" }}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          <nav className="db-nav" aria-label="Dashboard sections">
            {(["operations", "configure", "governance"] as const).map((groupKey) => {
              const items = grouped.get(groupKey) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={groupKey}>
                  {!collapsed ? <div className="db-nav-group-label">{GROUP_LABELS[groupKey]}</div> : null}
                  {items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`db-nav-link ${isActive ? "db-nav-link-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="db-nav-link-text">{collapsed ? item.label.charAt(0) : item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="db-sidebar-foot">
            {!collapsed ? (
              <p className="db-brand-sub db-user-label" title={userEmail ?? undefined}>
                {userEmail ?? "--"}
              </p>
            ) : null}
            <button type="button" onClick={onLogout} className="db-btn db-btn-secondary" style={{ width: "100%" }}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="db-main">
        <header className="db-topbar">
          <input
            ref={searchRef}
            className="db-command"
            placeholder="Search conversations, clients, tickets... (Ctrl/Cmd+K)"
            value={globalSearch}
            onChange={(event) => {
              const query = event.target.value;
              setGlobalSearch(query);
              window.dispatchEvent(new CustomEvent("dashboard:global-search", { detail: { query } }));
            }}
            aria-label="Global search"
          />
          <select
            className="db-select"
            style={{ width: "auto", minWidth: "120px" }}
            value={dateRange}
            onChange={(event) => {
              const value = event.target.value;
              setDateRange(value);
              window.dispatchEvent(
                new CustomEvent("dashboard:date-range", { detail: { days: Number.parseInt(value, 10) || 7 } })
              );
            }}
            aria-label="Date range"
          >
            <option value="1">Last 24h</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <button
            type="button"
            className={`db-btn ${liveEnabled ? "db-btn-primary" : "db-btn-secondary"}`}
            onClick={() => {
              const next = !liveEnabled;
              setLiveEnabled(next);
              window.dispatchEvent(new CustomEvent("dashboard:live-toggle", { detail: { enabled: next } }));
            }}
            aria-label={liveEnabled ? "Disable live mode" : "Enable live mode"}
          >
            {liveEnabled ? "Live On" : "Live Off"}
          </button>
          <button
            type="button"
            className="db-btn db-btn-secondary"
            onClick={() => window.dispatchEvent(new Event("dashboard:refresh"))}
          >
            Refresh
          </button>
        </header>

        <main className="db-content">{children}</main>
      </div>
    </div>
  );
}
