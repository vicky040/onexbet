"use client";

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
  MessagesSquare,
  ScrollText,
  Settings,
  Users,
  Wallet,
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
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Users, badge: "agents" },
  { href: "/deposits", label: "Deposits", icon: ArrowDownToLine, badge: "deposits" },
  { href: "/payouts", label: "Payouts", icon: Banknote, badge: "payouts" },
  { href: "/payins", label: "Payins", icon: Wallet },
  { href: "/banks", label: "Bank accounts", icon: Landmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/support", label: "Support", icon: MessagesSquare, badge: "support" },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

export function SidebarNav({ badges }: { badges: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const count = item.badge ? badges[item.badge] : undefined;

        return (
          <Link
            key={item.href}
            href={item.href}
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
