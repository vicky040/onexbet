import type { ReactNode } from "react";
import clsx from "clsx";
import { formatInr } from "@/lib/money";

/** Shared presentational pieces. Server-safe: no hooks, no event handlers. */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("card overflow-hidden", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "navy" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "card",
    navy: "bg-navy text-white border border-navy",
    success: "card border-success/30",
    warning: "card border-warning/40",
    danger: "card border-danger/40",
  } as const;

  const valueTone = {
    default: "text-navy",
    navy: "text-white",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  } as const;

  return (
    <div className={clsx(tones[tone], "rounded-2xl p-4")}>
      <p
        className={clsx(
          "text-xs font-semibold uppercase tracking-wide",
          tone === "navy" ? "text-white/70" : "text-muted",
        )}
      >
        {label}
      </p>
      <p className={clsx("tabular mt-2 text-2xl font-bold", valueTone[tone])}>
        {value}
      </p>
      {hint ? (
        <p
          className={clsx(
            "mt-1 text-xs",
            tone === "navy" ? "text-white/60" : "text-muted",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-inset text-muted",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** One place that decides what colour a status is, panel-wide. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "COMPLETED":
    case "ACTIVE":
      return "success";
    case "PAYMENT_RECEIVED":
      return "info";
    case "PENDING":
    case "ACCEPTED":
    case "OPEN":
      return "warning";
    case "FAILED":
    case "BLOCKED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone(status)}>
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-inset px-6 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Money({
  value,
  tone,
}: {
  value: number | string;
  tone?: "success" | "danger" | "muted";
}) {
  const tones = {
    success: "text-success",
    danger: "text-danger",
    muted: "text-muted",
  } as const;

  return (
    <span className={clsx("tabular font-semibold", tone && tones[tone])}>
      {formatInr(value)}
    </span>
  );
}

export function DateTime({ value }: { value: string | Date | null }) {
  if (!value) return <span className="text-muted">—</span>;
  const date = typeof value === "string" ? new Date(value) : value;
  return (
    <span className="tabular whitespace-nowrap text-xs text-muted">
      {date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}
    </span>
  );
}

export function AgentCell({
  agent,
}: {
  agent: { id: string; name: string; mobile: string } | null;
}) {
  if (!agent) {
    return <span className="text-xs font-medium text-muted">Open to all</span>;
  }
  return (
    <div className="min-w-0">
      <a
        href={`/agents/${agent.id}`}
        className="block truncate font-medium text-navy hover:text-sky hover:underline"
      >
        {agent.name}
      </a>
      <span className="tabular text-xs text-muted">+91 {agent.mobile}</span>
    </div>
  );
}

/** A plain GET form, so filters live in the URL and survive a refresh. */
export function FilterBar({
  children,
  reset,
}: {
  children: ReactNode;
  reset?: string;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
      {children}
      <button
        type="submit"
        className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-soft"
      >
        Filter
      </button>
      {reset ? (
        <a
          href={reset}
          className="px-1 py-2.5 text-sm font-medium text-muted hover:text-navy hover:underline"
        >
          Clear
        </a>
      ) : null}
    </form>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  query,
  basePath,
}: {
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string | undefined>;
  basePath: string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="mt-4 text-xs text-muted">
        {total} record{total === 1 ? "" : "s"}
      </p>
    );
  }

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">
        Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a
            href={href(page - 1)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-sky hover:text-sky"
          >
            Previous
          </a>
        ) : null}
        {page < totalPages ? (
          <a
            href={href(page + 1)}
            className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-sky hover:text-sky"
          >
            Next
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function Reference({ children }: { children: ReactNode }) {
  return (
    <span className="tabular text-xs font-semibold tracking-wide text-ink">
      {children}
    </span>
  );
}
