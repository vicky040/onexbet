import type { Prisma } from "@prisma/client";
import { toggleBankAction } from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
import { ActionForm, SubmitButton } from "@/components/form";
import {
  AgentCell,
  Badge,
  Card,
  DateTime,
  FilterBar,
  PageHeader,
  Pagination,
  StatTile,
} from "@/components/ui";
import { isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/money";

export const metadata = { title: "Bank accounts · 1XBET Agent Admin" };

const PER_PAGE = 25;

type BankAccount = Prisma.BankAccountGetPayload<{
  include: {
    agent: { select: { id: true; name: true; mobile: true; status: true } };
  };
}>;

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    active?: string;
    agentId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim();
  const superAdmin = await isSuperAdmin();

  const where: Prisma.BankAccountWhereInput = {
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(params.active === "true" || params.active === "false"
      ? { isActive: params.active === "true" }
      : {}),
    ...(q
      ? {
          OR: [
            { bankName: { contains: q, mode: "insensitive" } },
            { accountHolder: { contains: q, mode: "insensitive" } },
            { accountNumber: { contains: q } },
            { upiId: { contains: q, mode: "insensitive" } },
            { ifsc: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [banks, total, activeCount, allCount] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, mobile: true, status: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.bankAccount.count({ where }),
    prisma.bankAccount.count({ where: { isActive: true } }),
    prisma.bankAccount.count(),
  ]);

  const columns: Column<BankAccount>[] = [
    {
      header: "Bank",
      primary: true,
      cell: (bank) => (
        <div>
          <span className="font-semibold text-ink">{bank.bankName}</span>
          <span className="block text-xs text-muted">{bank.accountHolder}</span>
        </div>
      ),
    },
    { header: "Agent", cell: (bank) => <AgentCell agent={bank.agent} /> },
    {
      header: "Account",
      cell: (bank) => (
        <div className="tabular text-xs text-muted">
          <span>***{bank.accountNumber.slice(-4)}</span>
          <span className="block">{bank.ifsc}</span>
        </div>
      ),
    },
    {
      header: "UPI",
      cell: (bank) => <span className="text-xs text-muted">{bank.upiId}</span>,
    },
    {
      header: "Limits",
      numeric: true,
      cell: (bank) => (
        <div className="text-xs text-muted">
          <span>{formatInr(bank.amountLimit.toString())}</span>
          <span className="block">
            {bank.txnLimit} txns · daily {bank.dailyLimit}
          </span>
        </div>
      ),
    },
    {
      header: "State",
      cell: (bank) =>
        bank.isActive ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>,
    },
    { header: "Added", tableOnly: true, cell: (bank) => <DateTime value={bank.createdAt} /> },
    {
      header: "",
      actions: true,
      cell: (bank) =>
        superAdmin ? (
          <ActionForm action={toggleBankAction} hideMessage>
            <input type="hidden" name="bankId" value={bank.id} />
            <SubmitButton variant="secondary" size="sm">
              {bank.isActive ? "Turn off" : "Turn on"}
            </SubmitButton>
          </ActionForm>
        ) : (
          <span className="text-xs text-muted">View only</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bank accounts"
        subtitle="The accounts agents collect payins into. Only active ones receive money."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Accounts on file" value={`${allCount}`} />
        <StatTile
          label="Active"
          value={`${activeCount}`}
          hint="Receiving payins"
          tone={activeCount > 0 ? "success" : "warning"}
        />
        <StatTile label="Shown here" value={`${total}`} hint="Matching the filter" />
      </div>

      <div className="mt-6">
        <Card bodyClassName="p-5">
          <FilterBar reset="/banks">
            <label className="block">
              <span className="label">Search</span>
              <input
                className="field sm:w-64"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Bank, holder, account, IFSC or UPI"
              />
            </label>
            <label className="block">
              <span className="label">State</span>
              <select
                className="field sm:w-40"
                name="active"
                defaultValue={params.active ?? ""}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            {params.agentId ? (
              <input type="hidden" name="agentId" value={params.agentId} />
            ) : null}
          </FilterBar>

          <DataTable
            columns={columns}
            rows={banks}
            rowKey={(bank) => bank.id}
            empty="No bank accounts match this filter."
            minWidth="56rem"
          />

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
            query={{ q, active: params.active, agentId: params.agentId }}
            basePath="/banks"
          />
        </Card>
      </div>
    </>
  );
}
