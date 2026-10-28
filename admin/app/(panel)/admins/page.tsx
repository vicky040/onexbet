import type { Prisma } from "@prisma/client";
import { createAdminAction, updateAdminAction } from "@/app/actions";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActionForm,
  Disclosure,
  Field,
  Select,
  SubmitButton,
} from "@/components/form";
import {
  Badge,
  Card,
  DateTime,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Panel users · 1XBET Agent Admin" };

export default async function AdminsPage() {
  const actor = await getAdmin();

  // Operators have no business seeing, let alone editing, who can sign in.
  // Saying so beats a silent redirect to somewhere they did not ask for.
  if (!actor || actor.role !== "SUPER_ADMIN") {
    return (
      <>
        <PageHeader title="Panel users" />
        <Card title="Super admins only">
          <p className="text-sm text-muted">
            Managing who can sign in is restricted to super admins. Ask one of
            them if you need access to this screen.
          </p>
        </Card>
      </>
    );
  }

  const [admins, masterAgents] = await Promise.all([
    prisma.admin.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { agent: { select: { id: true, name: true, mobile: true } } },
    }),
    // Agents on the Master plan who do not have a panel account yet.
    prisma.agent.findMany({
      where: { plan: "MASTER", panelAccount: { is: null } },
      select: { id: true, name: true, mobile: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const superAdmins = admins.filter(
    (admin) => admin.role === "SUPER_ADMIN" && admin.isActive,
  ).length;

  type PanelUser = Prisma.AdminGetPayload<{
    include: { agent: { select: { id: true; name: true; mobile: true } } };
  }>;

  const columns: Column<PanelUser>[] = [
    {
      header: "User",
      primary: true,
      cell: (admin) => (
        <div>
          <span className="font-semibold text-ink">
            {admin.name}
            {admin.id === actor.id ? (
              <span className="ml-2 text-xs font-normal text-muted">(you)</span>
            ) : null}
          </span>
          <span className="block text-xs text-muted">{admin.email}</span>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (admin) =>
        admin.role === "SUPER_ADMIN" ? (
          <Badge tone="info">Super admin</Badge>
        ) : admin.role === "MASTER_ADMIN" ? (
          <div>
            <Badge tone="warning">Master</Badge>
            {admin.agent ? (
              <span className="mt-1 block text-xs text-muted">
                {admin.agent.name}
              </span>
            ) : null}
          </div>
        ) : (
          <Badge>Operator</Badge>
        ),
    },
    {
      header: "Access",
      cell: (admin) =>
        admin.isActive ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="danger">Disabled</Badge>
        ),
    },
    {
      header: "Last signed in",
      cell: (admin) => <DateTime value={admin.lastLoginAt} />,
    },
    {
      header: "Added",
      tableOnly: true,
      cell: (admin) => <DateTime value={admin.createdAt} />,
    },
    {
      header: "",
      actions: true,
      cell: (admin) => {
        const isSelf = admin.id === actor.id;
        const lastSuperAdmin =
          admin.role === "SUPER_ADMIN" && admin.isActive && superAdmins === 1;

        return (
          <>
            {admin.role === "MASTER_ADMIN" ? null : admin.role === "OPERATOR" ? (
              <ActionForm action={updateAdminAction} hideMessage>
                <input type="hidden" name="adminId" value={admin.id} />
                <input type="hidden" name="role" value="SUPER_ADMIN" />
                <SubmitButton variant="secondary" size="sm">
                  Make super admin
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm
                action={updateAdminAction}
                hideMessage
                confirm={`Make ${admin.email} an operator? They will lose access to agent data, corrections and settings.`}
              >
                <input type="hidden" name="adminId" value={admin.id} />
                <input type="hidden" name="role" value="OPERATOR" />
                <SubmitButton
                  variant="secondary"
                  size="sm"
                  className={isSelf || lastSuperAdmin ? "hidden" : undefined}
                >
                  Make operator
                </SubmitButton>
              </ActionForm>
            )}

            {admin.isActive ? (
              <ActionForm
                action={updateAdminAction}
                hideMessage
                confirm={`Disable ${admin.email}? They will not be able to sign in.`}
              >
                <input type="hidden" name="adminId" value={admin.id} />
                <input type="hidden" name="isActive" value="false" />
                <SubmitButton
                  variant="danger"
                  size="sm"
                  className={isSelf || lastSuperAdmin ? "hidden" : undefined}
                >
                  Disable
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={updateAdminAction} hideMessage>
                <input type="hidden" name="adminId" value={admin.id} />
                <input type="hidden" name="isActive" value="true" />
                <SubmitButton variant="success" size="sm">
                  Enable
                </SubmitButton>
              </ActionForm>
            )}
          </>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Panel users"
        subtitle="Who can sign in to this admin panel, and what they may change."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Panel users" value={`${admins.length}`} />
        <StatTile
          label="Super admins"
          value={`${superAdmins}`}
          hint="Can change agent data, corrections and settings"
          tone={superAdmins === 1 ? "warning" : "default"}
        />
        <StatTile
          label="Disabled"
          value={`${admins.filter((admin) => !admin.isActive).length}`}
        />
      </div>

      <div className="mt-6 mb-6">
        <Disclosure summary="Add a panel user">
          <ActionForm
            action={createAdminAction}
            resetOnSuccess
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" required />
              <Field label="Email" name="email" type="email" required />
              <Field
                label="Password"
                name="password"
                type="password"
                required
                minLength={6}
                hint="At least 6 characters. Share it with them directly."
              />
              <Select label="Role" name="role" defaultValue="OPERATOR">
                <option value="OPERATOR">
                  Operator — day-to-day review and payouts
                </option>
                <option value="SUPER_ADMIN">
                  Super admin — everything, including corrections
                </option>
                <option value="MASTER_ADMIN">
                  Master — their own referred agents only
                </option>
              </Select>
              <Select label="Master's agent" name="agentId" defaultValue="">
                <option value="">
                  {masterAgents.length === 0
                    ? "No agents on the Master plan yet"
                    : "Only needed for a Master account"}
                </option>
                {masterAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} (+91 {agent.mobile})
                  </option>
                ))}
              </Select>
            </div>
            <SubmitButton>Create user</SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>

      <Card
        title="Users"
        description="An operator can review deposits, create and settle payouts, record payins, send notifications and answer support. A super admin can additionally change agent data and commission rates, correct payins and payouts, adjust balances, edit settings and manage these users. A master sees only the agents they referred, and may change nothing about them but their commission rates."
        bodyClassName="p-5"
      >
        <DataTable
          columns={columns}
          rows={admins}
          rowKey={(admin) => admin.id}
          empty="No panel users yet."
          minWidth="52rem"
        />
      </Card>

      <Card
        title="Reset someone's password"
        description="Sets a new password for a user. Tell them in person; this panel does not email it."
        className="mt-6"
      >
        <ActionForm action={updateAdminAction} resetOnSuccess className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="User" name="adminId" required defaultValue="">
              <option value="" disabled>
                Choose a user
              </option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name} ({admin.email})
                </option>
              ))}
            </Select>
            <Field
              label="New password"
              name="password"
              type="password"
              required
              minLength={6}
            />
          </div>
          <SubmitButton variant="secondary">Set password</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
