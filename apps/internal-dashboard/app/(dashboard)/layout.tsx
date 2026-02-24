"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { InternalLoginRequest, InternalLoginResponse } from "@clientpulse/types";
import { DashboardLayout } from "../../components/DashboardLayout";
import { DashboardClient } from "../../components/DashboardClient";
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
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: UserInfo } | null) => {
        if (data?.user) {
          setUser(data.user);
          if (storedToken) setToken(storedToken);
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error) console.warn("Session check failed:", e.message);
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
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOnboarding(data))
      .catch((e: unknown) => {
        if (e instanceof Error) console.warn("Onboarding fetch failed:", e.message);
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
      setStoredToken(data.token);
      const userInfo: UserInfo = {
        id: data.user.id,
        companyId: data.user.companyId,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role
      };
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
        <p className="text-slate-500 text-sm">Checking session…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Internal Login</h2>
          <p className="mt-1 text-sm text-slate-500">Use email and password to access the dashboard.</p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="form-field">
              <label className="form-label" htmlFor="login-company">Company slug</label>
              <input
                id="login-company"
                value={companySlug}
                onChange={(e) => setCompanySlug(e.target.value)}
                placeholder="e.g. acme"
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                className="form-input"
                onKeyDown={(e) => { if (e.key === "Enter" && !authBusy) void login(); }}
              />
            </div>
            <button
              type="button"
              onClick={() => void login()}
              disabled={authBusy}
              className="btn-form btn-form-primary mt-1 w-full"
            >
              {authBusy ? "Signing in…" : "Sign in"}
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
