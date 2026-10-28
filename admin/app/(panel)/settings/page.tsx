import { updateSettingsAction } from "@/app/actions";
import {
  ActionForm,
  Checkbox,
  Field,
  SubmitButton,
  Textarea,
} from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { isSuperAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { formatInr, formatPercent } from "@/lib/money";

export const metadata = { title: "Settings · 1XBET Agent Admin" };

export default async function SettingsPage() {
  const [settings, superAdmin] = await Promise.all([
    getSettings(),
    isSuperAdmin(),
  ]);

  // These values decide commission on every transaction, so operators see
  // them but cannot move them.
  if (!superAdmin) {
    return (
      <>
        <PageHeader
          title="Settings"
          subtitle="Defaults applied to new agents, and the rules the mobile app follows."
        />
        <Card
          title="Current settings"
          description="Changing these is restricted to super admins."
        >
          <dl className="space-y-2 text-sm">
            {[
              ["Default payin commission", formatPercent(settings.defaultPayinCommissionRate.toString())],
              ["Default payout commission", formatPercent(settings.defaultPayoutCommissionRate.toString())],
              ["Minimum deposit", formatInr(settings.minDepositAmount.toString())],
              ["Required security deposit", `${settings.requiredSecurityDepositUsdt.toString()} USDT`],
              ["Sign-ups", settings.signupsEnabled ? "Open" : "Closed"],
              ["New agents need approval", settings.requireAgentApproval ? "Yes" : "No"],
              ["Deposits auto-approved", settings.autoApproveDeposits ? "Yes" : "No"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted">{label}</dt>
                <dd className="tabular font-semibold text-ink">{value}</dd>
              </div>
            ))}
            <div className="pt-2">
              <dt className="text-muted">Support welcome message</dt>
              <dd className="mt-1">{settings.supportWelcomeMessage}</dd>
            </div>
          </dl>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Defaults applied to new agents, and the rules the mobile app follows."
      />

      <ActionForm action={updateSettingsAction} className="space-y-6">
        <Card
          title="Commission defaults"
          description="Applied to agents created from now on. Existing agents keep their own rates."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Payin commission %"
              name="defaultPayinCommissionRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={settings.defaultPayinCommissionRate.toString()}
            />
            <Field
              label="Payout commission %"
              name="defaultPayoutCommissionRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={settings.defaultPayoutCommissionRate.toString()}
            />
          </div>
        </Card>

        <Card title="Deposits">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Minimum deposit (₹)"
                name="minDepositAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings.minDepositAmount.toString()}
                hint="The app refuses anything smaller"
              />
              <Field
                label="Required security deposit (USDT)"
                name="requiredSecurityDepositUsdt"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings.requiredSecurityDepositUsdt.toString()}
              />
            </div>
            <Checkbox
              name="autoApproveDeposits"
              label="Approve deposits automatically"
              hint="Credits an agent's balance the moment they submit, with no review. Leave off unless you reconcile another way."
              defaultChecked={settings.autoApproveDeposits}
            />
          </div>
        </Card>

        <Card title="Sign-ups">
          <div className="space-y-4">
            <Checkbox
              name="signupsEnabled"
              label="Allow new sign-ups from the app"
              hint="When off, the app's Create account screen is refused."
              defaultChecked={settings.signupsEnabled}
            />
            <Checkbox
              name="requireAgentApproval"
              label="New agents need approval before they can sign in"
              hint="They land in Pending and get no session until an admin activates them."
              defaultChecked={settings.requireAgentApproval}
            />
          </div>
        </Card>

        <Card
          title="Support"
          description="The first line every new agent sees in the chat."
        >
          <Textarea
            label="Welcome message"
            name="supportWelcomeMessage"
            rows={2}
            maxLength={500}
            defaultValue={settings.supportWelcomeMessage}
          />
        </Card>

        <div className="flex items-center gap-4">
          <SubmitButton>Save settings</SubmitButton>
          <p className="text-xs text-muted">
            Last updated{" "}
            {settings.updatedAt.toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </p>
        </div>
      </ActionForm>
    </>
  );
}
