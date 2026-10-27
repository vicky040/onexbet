import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, pageMeta, readPagination, withRoute } from "@/lib/http";
import { adminBankAccount } from "@/lib/admin-serializers";

export const dynamic = "force-dynamic";

/** Every agent's bank account. `?agentId=`, `?active=true|false`, `?q=`. */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const page = readPagination(url);

  const agentId = url.searchParams.get("agentId") || undefined;
  const active = url.searchParams.get("active");
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.BankAccountWhereInput = {
    ...(agentId ? { agentId } : {}),
    ...(active === "true" || active === "false"
      ? { isActive: active === "true" }
      : {}),
    ...(q
      ? {
          OR: [
            { bankName: { contains: q, mode: "insensitive" as const } },
            { accountHolder: { contains: q, mode: "insensitive" as const } },
            { accountNumber: { contains: q } },
            { upiId: { contains: q, mode: "insensitive" as const } },
            { ifsc: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [banks, total, activeCount] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
    }),
    prisma.bankAccount.count({ where }),
    prisma.bankAccount.count({ where: { isActive: true } }),
  ]);

  return ok(banks.map(adminBankAccount), {
    meta: { ...pageMeta(page, total), activeCount },
  });
});
