import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { createAgentAction } from "@/app/actions";
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
  Card,
  DateTime,
  FilterBar,
  Money,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import { isSuperAdmin } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { formatPercent } from "@/lib/money";

export const metadata = { title: "Agents · 1XBET Agent Admin" };

const PER_PAGE = 25;

type Agent = Prisma.AgentGetPayload<{
  include: {
    _count: { select: { payins: true; payouts: true; bankAccounts: true } };
  };
}>;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status = params.status?.toUpperCase();
  const q = params.q?.trim();
  const superAdmin = await isSuperAdmin();

  const where: Prisma.AgentWhereInput = {
    ...(status && ["PENDING", "ACTIVE", "BLOCKED"].includes(status)
      ? { status: status as Prisma.AgentWhereInput["status"] }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { mobile: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [agents, total, settings] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        _count: { select: { payins: true, payouts: true, bankAccounts: true } },
      },
    }),
    prisma.agent.count({ where }),
    getSettings(),
  ]);

  const columns: Column<Agent>[] = [
    {
      header: "Agent",
      primary: true,
      cell: (agent) => (
        <div>
          <Link
            href={`/agents/${agent.id}`}
            className="font-semibold text-navy hover:text-sky hover:underline"
          >
            {agent.name}
          </Link>
          <span className="tabular block text-xs text-muted">
            +91 {agent.mobile} · {agent.email}
          </span>
        </div>
      ),
    },
    { header: "Status", cell: (agent) => <StatusBadge status={agent.status} /> },
    {
      header: "Balance",
      numeric: true,
      cell: (agent) => <Money value={agent.balance.toString()} />,
    },
    {
      header: "Commission",
      numeric: true,
      cell: (agent) => (
        <span className="text-xs text-muted">
          in {formatPercent(agent.payinCommissionRate.toString())} · out{" "}
          {formatPercent(agent.payoutCommissionRate.toString())}
        </span>
      ),
    },
    {
      header: "Activity",
      cell: (agent) => (
        <span className="text-xs text-muted">
          {agent._count.payins} payins · {agent._count.payouts} payouts ·{" "}
          {agent._count.bankAccounts} banks
        </span>
      ),
    },
    { header: "Joined", tableOnly: true, cell: (agent) => <DateTime value={agent.createdAt} /> },
  ];

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Everyone who can sign in to the mobile app."
      />

      {superAdmin ? (
        <div className="mb-6">
          <Disclosure summary="Add an agent">
            <ActionForm
              action={createAgentAction}
              resetOnSuccess
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" name="name" required />
                <Field
                  label="Mobile number"
                  name="mobile"
                  required
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  hint="10 digits, starting 6-9"
                />
                <Field label="Email" name="email" type="email" required />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  hint="At least 6 characters"
                />
                <Field
                  label="Payin commission %"
                  name="payinCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={settings.defaultPayinCommissionRate.toString()}
                />
                <Field
                  label="Payout commission %"
                  name="payoutCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={settings.defaultPayoutCommissionRate.toString()}
                />
                <Field
                  label="Security deposit (USDT)"
                  name="securityDepositUsdt"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={settings.requiredSecurityDepositUsdt.toString()}
                />
                <Select label="Status" name="status" defaultValue="ACTIVE">
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending approval</option>
                  <option value="BLOCKED">Blocked</option>
                </Select>
              </div>
              <Textarea label="Internal notes" name="notes" rows={2} />
              <SubmitButton>Create agent</SubmitButton>
            </ActionForm>
          </Disclosure>
        </div>
      ) : null}

      <Card bodyClassName="p-5">
        <FilterBar reset="/agents">
          <label className="block">
            <span className="label">Search</span>
            <input
              className="field sm:w-64"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name, mobile or email"
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
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={agents}
          rowKey={(agent) => agent.id}
          empty="No agents match this filter."
          minWidth="56rem"
        />

        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
          query={{ q, status }}
          basePath="/agents"
        />
      </Card>
    </>
  );
}
