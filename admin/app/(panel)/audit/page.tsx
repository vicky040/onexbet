import type { Prisma } from "@prisma/client";
import {
  Card,
  DateTime,
  FilterBar,
  PageHeader,
  Pagination,
  Table,
  Td,
} from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "Audit log · 1XBET Agent Admin" };

const PER_PAGE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(params.action
      ? { action: { contains: params.action, mode: "insensitive" } }
      : {}),
    ...(params.entity ? { entity: params.entity } : {}),
  };

  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every action an admin took that moved money or changed an account."
      />

      <Card bodyClassName="p-5">
        <FilterBar reset="/audit">
          <label className="block">
            <span className="label">Action</span>
            <input
              className="field sm:w-56"
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="deposit.approve"
            />
          </label>
          <label className="block">
            <span className="label">Entity</span>
            <select
              className="field sm:w-44"
              name="entity"
              defaultValue={params.entity ?? ""}
            >
              <option value="">All</option>
              {entities.map((row) => (
                <option key={row.entity} value={row.entity}>
                  {row.entity} ({row._count._all})
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        <Table
          head={["When", "Admin", "Action", "What happened"]}
          empty="Nothing has been recorded yet."
        >
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-inset/60">
              <Td>
                <DateTime value={log.createdAt} />
              </Td>
              <Td>
                <span className="text-sm font-medium text-ink">
                  {log.admin?.name ?? "—"}
                </span>
                <span className="block text-xs text-muted">
                  {log.admin?.email ?? "deleted admin"}
                </span>
              </Td>
              <Td>
                <code className="rounded bg-inset px-1.5 py-0.5 text-xs font-semibold text-info">
                  {log.action}
                </code>
              </Td>
              <Td>
                <span className="text-sm text-ink">{log.summary}</span>
                <span className="block text-xs text-muted">
                  {log.entity}
                  {log.entityId ? ` · ${log.entityId}` : ""}
                </span>
              </Td>
            </tr>
          ))}
        </Table>

        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          total={total}
          query={{ action: params.action, entity: params.entity }}
          basePath="/audit"
        />
      </Card>
    </>
  );
}
