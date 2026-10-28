"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  Banknote,
  Bell,
  Landmark,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";

export type NavBadges = {
  deposits?: number;
  payouts?: number;
  support?: number;
  agents?: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: keyof NavBadges;
  /** Hidden from operators. */
  superAdminOnly?: boolean;
  /** A master sees only the screens marked here. */
  masters?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, masters: true },
  { href: "/agents", label: "Agents", icon: Users, badge: "agents", masters: true },
  { href: "/deposits", label: "Deposits", icon: ArrowDownToLine, badge: "deposits" },
  { href: "/payouts", label: "Payouts", icon: Banknote, badge: "payouts" },
  { href: "/payins", label: "Payins", icon: Wallet },
  { href: "/banks", label: "Bank accounts", icon: Landmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/support", label: "Support", icon: MessagesSquare, badge: "support" },
  { href: "/admins", label: "Panel users", icon: ShieldCheck, superAdminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

function useVisibleNav(role: string) {
  if (role === "MASTER_ADMIN") return NAV.filter((item) => item.masters);
  return NAV.filter(
    (item) => !item.superAdminOnly || role === "SUPER_ADMIN",
  );
}

function NavLinks({
  badges,
  role,
  onNavigate,
}: {
  badges: NavBadges;
  role: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = useVisibleNav(role);

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const count = item.badge ? badges[item.badge] : undefined;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-white/15 text-white"
                : "text-white/65 hover:bg-white/10 hover:text-white",
            )}
          >
            <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
            <span className="flex-1 truncate">{item.label}</span>
            {count ? (
              <span className="tabular min-w-5 rounded-full bg-sky px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div>
      <p className="text-2xl font-black italic leading-none tracking-tight text-brand">
        1XBET
      </p>
      <p className="text-[11px] tracking-[0.18em] text-white/55">ADMIN PANEL</p>
    </div>
  );
}

/** The permanent sidebar, from `lg` up. */
export function Sidebar({
  badges,
  role,
  footer,
}: {
  badges: NavBadges;
  role: string;
  footer: ReactNode;
}) {
  return (
    <aside className="hidden shrink-0 flex-col bg-navy px-4 py-7 lg:flex lg:w-64">
      <div className="mb-6 px-2">
        <Brand />
      </div>
      <NavLinks badges={badges} role={role} />
      <div className="mt-auto border-t border-white/10 pt-4">{footer}</div>
    </aside>
  );
}

/**
 * Below `lg`, a compact bar with a drawer behind it — a stacked sidebar
 * would push the actual page off the first screen.
 */
export function MobileNav({
  badges,
  role,
  footer,
}: {
  badges: NavBadges;
  role: string;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Each link closes the drawer itself via onNavigate, so there is no need
  // to watch the pathname. Escape closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the drawer from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const alerts =
    (badges.deposits ?? 0) + (badges.payouts ?? 0) + (badges.support ?? 0);

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-navy px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="relative rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <Menu className="size-6" />
          {alerts > 0 ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-sky" />
          ) : null}
        </button>
        <Brand />
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex w-[17rem] max-w-[85vw] flex-col overflow-y-auto bg-navy px-4 py-4"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="mb-5 flex items-start justify-between gap-3 px-2">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks
              badges={badges}
              role={role}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-6 border-t border-white/10 pt-4">{footer}</div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/50"
          />
        </div>
      ) : null}
    </div>
  );
}
