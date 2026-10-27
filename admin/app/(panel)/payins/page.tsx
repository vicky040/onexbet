import type { Prisma } from "@prisma/client";
import { createPayinAction } from "@/app/actions";
import {
  ActionForm,
  Disclosure,
  Field,
  Select,
  SubmitButton,
} from "@/components/form";
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
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatInr, formatPercent, toNumber } from "@/lib/money";

export const metadata = { title: "Payins · 1XBET Agent Admin" };

const PER_PAGE = 25;

export default async function PayinsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; agentId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim();

  const where: Prisma.PayinWhereInput = {
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { txnRef: { contains: q } },
          ],
        }
      : {}),
  };

  const [payins, total, totals, agents] = await Promise.all([
    prisma.payin.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.payin.count({ where }),
    prisma.payin.aggregate({ where, _sum: { amount: true, commission: true } }),
    prisma.agent.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, mobile: true, balance: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Payins"
        subtitle="Player money paid into an agent's bank. Recording one spends their float and pays commission."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Volume"
          value={formatInr(toNumber(totals._sum.amount))}
          hint="Matching the filter"
        />
        <StatTile
          label="Commission paid"
          value={formatInr(toNumber(totals._sum.commission))}
          hint="To agents"
        />
        <StatTile label="Records" value={`${total}`} />
      </div>

      <div className="mt-6 mb-6">
        <Disclosure summary="Record a payin">
          <ActionForm
            action={createPayinAction}
            resetOnSuccess
            className="space-y-4"
            confirm="Record this payin? It debits the agent's float immediately."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Agent" name="agentId" required defaultValue="">
                <option value="" disabled>
                  Choose an agent
                </option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} — {formatInr(agent.balance.toString())} available
                  </option>
                ))}
              </Select>
              <Field
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
              />
              <Field
                label="Player transaction reference"
                name="txnRef"
                required
                placeholder="UTR of the player's transfer"
              />
              <Field
                label="Commission %"
                name="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Agent's own rate"
                hint="Leave blank to use the agent's rate"
              />
            </div>
            <SubmitButton>Record payin</SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>

      <Card bodyClassName="p-5">
        <FilterBar reset="/payins">
          <label className="block">
            <span className="label">Search</span>
            <input
              className="field sm:w-64"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Reference or player UTR"
            />
          </label>
          {params.agentId ? (
            <input type="hidden" name="agentId" value={params.agentId} />
          ) : null}
        </FilterBar>

        <Table
          head={[
            "Reference",
            "Agent",
            "Amount",
            "Commission",
            "Balance after",
            "When",
          ]}
          empty="No payins match this filter."
        >
          {payins.map((payin) => (
            <tr key={payin.id} className="hover:bg-inset/60">
              <Td>
                <Reference>{payin.reference}</Reference>
                <span className="tabular block text-xs text-muted">
                  {payin.txnRef}
                </span>
              </Td>
              <Td>
                <AgentCell agent={payin.agent} />
              </Td>
              <Td numeric>
                <Money value={payin.amount.toString()} />
              </Td>
              <Td numeric>
                <Money value={payin.commission.toString()} tone="success" />
                <span className="block text-xs text-muted">
                  {formatPercent(payin.commissionRate.toString())}
                </span>
              </Td>
              <Td numeric>
                <span className="text-xs text-muted">
                  {formatInr(payin.previousBalance.toString())} →
                </span>
                <Money value={payin.afterBalance.toString()} tone="muted" />
              </Td>
              <Td>
                <DateTime value={payin.createdAt} />
              </Td>
            </tr>
          ))}
        </Table>

        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
          query={{ q, agentId: params.agentId }}
          basePath="/payins"
        />
      </Card>
    </>
  );
}
