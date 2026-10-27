import type { Prisma } from "@prisma/client";
import { approveDepositAction, rejectDepositAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import {
  AgentCell,
  Card,
  DateTime,
  FilterBar,
  Money,
  PageHeader,
  Pagination,
  Reference,
  StatTile,
  StatusBadge,
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatInr, toNumber } from "@/lib/money";

export const metadata = { title: "Deposits · 1XBET Agent Admin" };

const PER_PAGE = 25;

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    agentId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status?.toUpperCase();
  const q = params.q?.trim();

  const where: Prisma.DepositWhereInput = {
    ...(status && ["PENDING", "COMPLETED", "FAILED"].includes(status)
      ? { status: status as Prisma.DepositWhereInput["status"] }
      : {}),
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { utr: { contains: q } },
          ],
        }
      : {}),
  };

  const [deposits, total, pending, approved] = await Promise.all([
    prisma.deposit.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.deposit.count({ where }),
    prisma.deposit.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.deposit.aggregate({
      where: { status: "COMPLETED" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Deposits"
        subtitle="Agents topping up their float. Approving credits their balance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          tone={pending._count._all > 0 ? "warning" : "default"}
          label="Awaiting review"
          value={`${pending._count._all}`}
          hint={formatInr(toNumber(pending._sum.amount))}
        />
        <StatTile
          label="Approved"
          value={`${approved._count._all}`}
          hint={formatInr(toNumber(approved._sum.amount))}
        />
        <StatTile label="Shown here" value={`${total}`} hint="Matching the filter" />
      </div>

      <div className="mt-6">
        <Card bodyClassName="p-5">
          <FilterBar reset="/deposits">
            <label className="block">
              <span className="label">Search</span>
              <input
                className="field sm:w-64"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Reference or UTR"
              />
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select
                className="field sm:w-44"
                name="status"
                defaultValue={status ?? ""}
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Approved</option>
                <option value="FAILED">Rejected</option>
              </select>
            </label>
            {params.agentId ? (
              <input type="hidden" name="agentId" value={params.agentId} />
            ) : null}
          </FilterBar>

          <Table
            head={["Reference", "Agent", "Amount", "UTR", "Status", "When", ""]}
            empty="No deposits match this filter."
          >
            {deposits.map((deposit) => (
              <tr key={deposit.id} className="hover:bg-inset/60">
                <Td>
                  <Reference>{deposit.reference}</Reference>
                  {deposit.reviewNote ? (
                    <span className="block max-w-48 truncate text-xs text-muted">
                      {deposit.reviewNote}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <AgentCell agent={deposit.agent} />
                </Td>
                <Td numeric>
                  <Money value={deposit.amount.toString()} />
                  {deposit.afterBalance ? (
                    <span className="block text-xs text-muted">
                      → {formatInr(deposit.afterBalance.toString())}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="tabular text-xs text-muted">{deposit.utr}</span>
                </Td>
                <Td>
                  <StatusBadge status={deposit.status} />
                </Td>
                <Td>
                  <DateTime value={deposit.createdAt} />
                </Td>
                <Td>
                  {deposit.status === "PENDING" ? (
                    <div className="flex justify-end gap-2">
                      <ActionForm
                        action={approveDepositAction}
                        hideMessage
                        confirm={`Approve ${deposit.reference} and credit ${formatInr(
                          deposit.amount.toString(),
                        )}?`}
                      >
                        <input type="hidden" name="depositId" value={deposit.id} />
                        <SubmitButton variant="success" size="sm">
                          Approve
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={rejectDepositAction}
                        hideMessage
                        confirm={`Reject ${deposit.reference}?`}
                      >
                        <input type="hidden" name="depositId" value={deposit.id} />
                        <SubmitButton variant="secondary" size="sm">
                          Reject
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  ) : (
                    <span className="block text-right text-xs text-muted">
                      {deposit.reviewedAt ? "Reviewed" : "—"}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            query={{ q, status, agentId: params.agentId }}
            basePath="/deposits"
          />
        </Card>
      </div>
    </>
  );
}
