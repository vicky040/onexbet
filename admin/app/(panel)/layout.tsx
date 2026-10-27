import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { SidebarNav, type NavBadges } from "@/components/sidebar";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Middleware already turned away anyone without a cookie; this is the
  // check that actually consults the database.
  const admin = await getAdmin();
  if (!admin) redirect("/login");

  const [deposits, payouts, support, pendingAgents] = await Promise.all([
    prisma.deposit.count({ where: { status: "PENDING" } }),
    prisma.payout.count({ where: { status: "PAYMENT_RECEIVED" } }),
    prisma.supportMessage.count({ where: { fromAgent: true, readByAdmin: false } }),
    prisma.agent.count({ where: { status: "PENDING" } }),
  ]);

  const badges: NavBadges = {
    deposits,
    payouts,
    support,
    agents: pendingAgents,
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col bg-navy px-4 py-5 lg:w-64 lg:py-7">
        <div className="mb-6 px-2">
          <p className="text-2xl font-black italic tracking-tight text-brand">
            1XBET
          </p>
          <p className="text-[11px] tracking-[0.18em] text-white/55">
            ADMIN PANEL
          </p>
        </div>

        <SidebarNav badges={badges} />

        <div className="mt-6 border-t border-white/10 pt-4 lg:mt-auto">
          <p className="truncate px-3 text-sm font-semibold text-white">
            {admin.name}
          </p>
          <p className="truncate px-3 text-xs text-white/55">{admin.email}</p>
          <p className="mt-1 px-3 text-[11px] font-medium tracking-wide text-sky">
            {admin.role.replace("_", " ")}
          </p>

          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-[18px]" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
