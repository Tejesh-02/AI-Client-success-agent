"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { InternalLoginRequest, InternalLoginResponse } from "@clientpulse/types";
import { DashboardClient } from "../../components/DashboardClient";
import { DashboardLayout } from "../../components/DashboardLayout";
import { getPermissions } from "../../components/shared/useAuth";
import type { UserInfo } from "../../components/shared/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const defaultCompanySlug = process.env.NEXT_PUBLIC_COMPANY_SLUG ?? "acme";

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("internal_access_token");
};

const setStoredToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("internal_access_token", token);
  else window.localStorage.removeItem("internal_access_token");
};

const getStoredUser = (): UserInfo | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("internal_user_v2");
    if (!raw) return null;
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
};

const setStoredUser = (user: UserInfo | null): void => {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem("internal_user_v2", JSON.stringify(user));
  else window.localStorage.removeItem("internal_user_v2");
};

export default function DashboardRouteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [companySlug, setCompanySlug] = useState(defaultCompanySlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [onboarding, setOnboarding] = useState<{
    stepsDone: string[];
    isProfileComplete: boolean;
    canGoLive: boolean;
  } | null>(null);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      setSessionChecked(true);
      return;
    }

    fetch(`${API_URL}/internal/v1/auth/me`, {
      credentials: "include",
      headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {}
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: UserInfo } | null) => {
        if (data?.user) {
          setUser(data.user);
          if (storedToken) setToken(storedToken);
        }
      })
      .catch(() => {
        // Keep user at login screen if check fails.
      })
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    fetch(`${API_URL}/internal/v1/onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      signal: abort.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setOnboarding(data))
      .catch(() => {
        // Onboarding is best-effort.
      });
    return () => abort.abort();
  }, [token]);

  const handleSessionExpired = () => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
    setStoredUser(null);
    fetch(`${API_URL}/internal/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  };

  const login = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const payload: InternalLoginRequest = { companySlug, email, password };
      const response = await fetch(`${API_URL}/internal/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error(data.error ?? "Login failed");
      }

      const data = (await response.json()) as InternalLoginResponse;
      const userInfo: UserInfo = {
        id: data.user.id,
        companyId: data.user.companyId,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role
      };

      setStoredToken(data.token);
      setStoredUser(userInfo);
      setToken(data.token);
      setUser(userInfo);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
    setStoredUser(null);
    fetch(`${API_URL}/internal/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    router.refresh();
  };

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Checking session...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--db-bg)" }}>
        <section className="db-panel w-full max-w-md">
          <h2 className="db-page-title" style={{ fontSize: "1.2rem" }}>Internal Login</h2>
          <p className="db-page-subtitle">Use your tenant slug and internal credentials.</p>
          <div className="mt-3 space-y-3">
            <div className="db-field">
              <label htmlFor="login-company">Company slug</label>
              <input id="login-company" className="db-input" value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} placeholder="e.g. acme" />
            </div>
            <div className="db-field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" className="db-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="db-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="db-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !authBusy) void login();
                }}
              />
            </div>
            <button type="button" onClick={() => void login()} disabled={authBusy} className="db-btn db-btn-primary w-full">
              {authBusy ? "Signing in..." : "Sign In"}
            </button>
          </div>
          {authError ? <p className="mt-3 text-sm text-red-600">{authError}</p> : null}
        </section>
      </div>
    );
  }

  const perms = getPermissions(user?.role);

  return (
    <DashboardLayout
      userEmail={user?.email ?? email ?? null}
      onLogout={logout}
      canManageKbSection={perms.canManageKb}
      canViewWebhooks={perms.canViewWebhooks}
      canViewAuditLog={perms.canViewAuditLog}
      onboardingProgress={onboarding}
    >
      <DashboardClient token={token} user={user} onSessionExpired={handleSessionExpired} />
    </DashboardLayout>
  );
}
