import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { MobileNav, Sidebar, type NavBadges } from "@/components/sidebar";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Every panel page reads live data behind a session, so none of them can be
 * prerendered. Saying so explicitly keeps `next build` from attempting it —
 * which otherwise queries the database during the build, and fails the build
 * outright when the deployment's DATABASE_URL is not set yet.
 *
 * Applies to every segment nested under this layout.
 */
export const dynamic = "force-dynamic";

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

  const isSuperAdmin = admin.role === "SUPER_ADMIN";

  const account = (
    <>
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
    </>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <MobileNav
        badges={badges}
        isSuperAdmin={isSuperAdmin}
        footer={account}
      />
      <Sidebar badges={badges} isSuperAdmin={isSuperAdmin} footer={account} />

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
