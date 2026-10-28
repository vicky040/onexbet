import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { createPayinAction, updatePayinAction } from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActionForm,
  Disclosure,
  Field,
  Select,
  SubmitButton,
  Textarea,
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
} from "@/components/ui";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr, formatPercent, toNumber } from "@/lib/money";

export const metadata = { title: "Payins · 1XBET Agent Admin" };

const PER_PAGE = 25;

type Payin = Prisma.PayinGetPayload<{
  include: {
    agent: { select: { id: true; name: true; mobile: true; status: true } };
  };
}>;

export default async function PayinsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    agentId?: string;
    page?: string;
    correct?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim();
  const superAdmin = await isSuperAdmin();

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

  const [payins, total, totals, agents, correcting] = await Promise.all([
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
    superAdmin && params.correct
      ? prisma.payin.findUnique({ where: { id: params.correct } })
      : null,
  ]);

  const columns: Column<Payin>[] = [
    {
      header: "Reference",
      primary: true,
      cell: (payin) => (
        <div>
          <Reference>{payin.reference}</Reference>
          <span className="tabular block text-xs text-muted">{payin.txnRef}</span>
        </div>
      ),
    },
    { header: "Agent", cell: (payin) => <AgentCell agent={payin.agent} /> },
    {
      header: "Amount",
      numeric: true,
      cell: (payin) => <Money value={payin.amount.toString()} />,
    },
    {
      header: "Commission",
      numeric: true,
      cell: (payin) => (
        <div>
          <Money value={payin.commission.toString()} tone="success" />
          <span className="block text-xs text-muted">
            {formatPercent(payin.commissionRate.toString())}
          </span>
        </div>
      ),
    },
    {
      header: "Balance after",
      numeric: true,
      cell: (payin) => (
        <div>
          <span className="text-xs text-muted">
            {formatInr(payin.previousBalance.toString())} →
          </span>{" "}
          <Money value={payin.afterBalance.toString()} tone="muted" />
        </div>
      ),
    },
    { header: "When", cell: (payin) => <DateTime value={payin.createdAt} /> },
    {
      header: "",
      actions: true,
      cell: (payin) =>
        superAdmin ? (
          <Link
            href={`/payins?correct=${payin.id}`}
            className="px-2 py-1.5 text-xs font-semibold text-sky hover:underline"
          >
            Correct
          </Link>
        ) : null,
    },
  ];

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

      {correcting ? (
        <div className="mt-6">
          <Card
            title={`Correct ${correcting.reference}`}
            description="Changing the amount or rate moves the agent's balance by the difference."
            actions={
              <Link
                href="/payins"
                className="text-xs font-semibold text-muted hover:text-navy hover:underline"
              >
                Cancel
              </Link>
            }
          >
            <ActionForm
              action={updatePayinAction}
              className="space-y-4"
              confirm="Apply this correction?"
            >
              <input type="hidden" name="payinId" value={correcting.id} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={correcting.amount.toString()}
                />
                <Field
                  label="Commission %"
                  name="commissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={correcting.commissionRate.toString()}
                />
                <Field
                  label="Player reference"
                  name="txnRef"
                  defaultValue={correcting.txnRef}
                />
              </div>
              <Textarea
                label="Reason"
                name="reason"
                required
                rows={2}
                placeholder="Why this record is being corrected"
              />
              <SubmitButton>Apply correction</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      ) : null}

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

        <DataTable
          columns={columns}
          rows={payins}
          rowKey={(payin) => payin.id}
          empty="No payins match this filter."
          minWidth="52rem"
        />

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
