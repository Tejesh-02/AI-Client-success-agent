"use client";

import type { ReactNode } from "react";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export const PageHeader = ({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <header className="db-page-header">
    <div>
      <h1 className="db-page-title">{title}</h1>
      {subtitle ? <p className="db-page-subtitle">{subtitle}</p> : null}
    </div>
    {actions ? <div className="db-page-actions">{actions}</div> : null}
  </header>
);

export const Panel = ({
  title,
  right,
  children,
  className
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cx("db-panel", className)}>
    {title || right ? (
      <div className="db-panel-head">
        {title ? <h2 className="db-panel-title">{title}</h2> : <div />}
        {right ? <div>{right}</div> : null}
      </div>
    ) : null}
    {children}
  </section>
);

export const MetricCard = ({
  label,
  value,
  trend,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  trend?: string;
  tone?: "neutral" | "danger" | "success" | "warning" | "info";
}) => (
  <article className={cx("db-metric-card", tone !== "neutral" && `db-metric-${tone}`)}>
    <p className="db-metric-label">{label}</p>
    <p className="db-metric-value">{value}</p>
    {trend ? <p className="db-metric-trend">{trend}</p> : null}
  </article>
);

export const Badge = ({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) => <span className={cx("db-badge", `db-badge-${tone}`)}>{children}</span>;

export const FilterBar = ({ children }: { children: ReactNode }) => (
  <div className="db-filter-bar">{children}</div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="db-error-state" role="alert">
    <p>{message}</p>
    {onRetry ? (
      <button type="button" className="db-btn db-btn-primary" onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </div>
);

export const EmptyState = ({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="db-empty-state">
    <h3>{title}</h3>
    {subtitle ? <p>{subtitle}</p> : null}
    {action}
  </div>
);

export const Drawer = ({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) =>
  open ? (
    <div className="db-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="db-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="db-drawer-head">
          <h3>{title}</h3>
          <button type="button" className="db-btn db-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="db-drawer-body">{children}</div>
      </aside>
    </div>
  ) : null;

export const deltaLabel = (value: number): string => {
  if (!Number.isFinite(value)) return "0%";
  const abs = Math.abs(value).toFixed(1);
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `-${abs}%`;
  return "0.0%";
};
