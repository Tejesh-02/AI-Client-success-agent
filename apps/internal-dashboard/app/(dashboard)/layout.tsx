"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { InternalLoginRequest, InternalLoginResponse } from "@clientpulse/types";
import { DashboardLayout } from "../../components/DashboardLayout";
import { DashboardClient } from "../../components/DashboardClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const defaultCompanySlug = process.env.NEXT_PUBLIC_COMPANY_SLUG ?? "acme";

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("internal_access_token");
};

const setToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("internal_access_token", token);
  else window.localStorage.removeItem("internal_access_token");
};

const getStoredUser = (): { id: string; role: string } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("internal_user");
    if (!raw) return null;
    return JSON.parse(raw) as { id: string; role: string };
  } catch {
    return null;
  }
};

const setStoredUser = (user: { id: string; role: string } | null): void => {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem("internal_user", JSON.stringify(user));
  else window.localStorage.removeItem("internal_user");
};

const getStoredEmail = (): string => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("internal_email") ?? "";
};

const setStoredEmail = (email: string): void => {
  if (typeof window === "undefined") return;
  if (email) window.localStorage.setItem("internal_email", email);
  else window.localStorage.removeItem("internal_email");
};

export default function DashboardRouteLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState(defaultCompanySlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [onboarding, setOnboarding] = useState<{
    stepsDone: string[];
    isProfileComplete: boolean;
    canGoLive: boolean;
  } | null>(null);

  useEffect(() => {
    setTokenState(getToken());
    setSidebarEmail(getStoredEmail());
  }, []);

  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    fetch(`${API_URL}/internal/v1/onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOnboarding(data))
      .catch(() => {});
    return () => abort.abort();
  }, [token]);

  const login = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const payload: InternalLoginRequest = { companySlug, email, password };
      const response = await fetch(`${API_URL}/internal/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error(data.error ?? "Login failed");
      }
      const data = (await response.json()) as InternalLoginResponse;
      setToken(data.token);
      setTokenState(data.token);
      setStoredUser({ id: data.user.id, role: data.user.role });
      setStoredEmail(email);
      setSidebarEmail(email);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    setTokenState(null);
    setToken(null);
    setStoredUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("internal_access_token");
      window.localStorage.removeItem("internal_user");
      window.localStorage.removeItem("internal_email");
    }
    router.refresh();
  };

  const canManageKbSection =
    getStoredUser()?.role === "admin" || getStoredUser()?.role === "manager";
  const canViewWebhooks = getStoredUser()?.role === "admin";
  const canViewAuditLog =
    getStoredUser()?.role === "admin" || getStoredUser()?.role === "manager";

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
                aria-label="Company slug"
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
                aria-label="Email"
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
                aria-label="Password"
                type="password"
                className="form-input"
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

  const handleSetToken = (t: string | null) => {
    setTokenState(t);
    if (!t && typeof window !== "undefined") {
      window.localStorage.removeItem("internal_access_token");
      window.localStorage.removeItem("internal_user");
      window.localStorage.removeItem("internal_email");
    }
  };

  return (
    <DashboardLayout
      userEmail={sidebarEmail || email || null}
      onLogout={logout}
      canManageKbSection={canManageKbSection}
      canViewWebhooks={canViewWebhooks}
      canViewAuditLog={canViewAuditLog}
      onboardingProgress={onboarding}
    >
      <DashboardClient token={token} setToken={handleSetToken} />
    </DashboardLayout>
  );
}
