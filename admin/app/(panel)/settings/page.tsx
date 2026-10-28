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
              ["Agent plan", `${settings.agentPlanUsdt.toString()} USDT`],
              ["Master plan", `${settings.masterPlanUsdt.toString()} USDT`],
              ["Bank transfer", settings.bankTransferEnabled ? "Enabled" : "Disabled"],
              ["Minimum top-up", `${settings.minDepositUsdt.toString()} USDT`],
              ["USDT rate", formatInr(settings.usdtInrRate.toString())],
              ["Minimum deposit (₹)", formatInr(Number(settings.minDepositUsdt) * Number(settings.usdtInrRate))],
              ["USDT network", settings.usdtNetwork],
              ["USDT address", settings.usdtDepositAddress],
              ["Required security deposit", `${settings.requiredSecurityDepositUsdt.toString()} USDT`],
              ["Sign-ups", settings.signupsEnabled ? "Open" : "Closed"],
              ["New agents need approval", settings.requireAgentApproval ? "Yes" : "No"],
              ["Deposits auto-approved", settings.autoApproveDeposits ? "Yes" : "No"],
              ["Startup dialog", settings.welcomeEnabled ? "Shown" : "Hidden"],
              ["Promotion", settings.promoEnabled ? "Shown" : "Hidden"],
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
                label="Minimum top-up (USDT)"
                name="minDepositUsdt"
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings.minDepositUsdt.toString()}
                hint="For agents who have already joined"
              />
              <Field
                label="USDT rate (₹ per USDT)"
                name="usdtInrRate"
                type="number"
                step="0.0001"
                min="0.0001"
                defaultValue={settings.usdtInrRate.toString()}
                hint={`Rupee minimum works out at ${formatInr(
                  Number(settings.minDepositUsdt) * Number(settings.usdtInrRate),
                )}`}
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

        <Card
          title="Joining plans"
          description="What a new agent pays to join. Their first deposit must match one of these exactly; afterwards they top up freely above the minimum."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Agent plan (USDT)"
                name="agentPlanUsdt"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={settings.agentPlanUsdt.toString()}
                hint={`About ${formatInr(
                  Number(settings.agentPlanUsdt) * Number(settings.usdtInrRate),
                )}`}
              />
              <Field
                label="Master plan (USDT)"
                name="masterPlanUsdt"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={settings.masterPlanUsdt.toString()}
                hint={`About ${formatInr(
                  Number(settings.masterPlanUsdt) * Number(settings.usdtInrRate),
                )}`}
              />
            </div>
            <Checkbox
              name="bankTransferEnabled"
              label="Accept bank transfers"
              hint="Off means USDT only. Turning it on adds the rupee option back to the app's Deposit screen."
              defaultChecked={settings.bankTransferEnabled}
            />
          </div>
        </Card>

        <Card
          title="USDT deposits"
          description="Where agents send USDT. The QR code in the app is a bundled image of this address — if you change the address here, the app's QR must be replaced too, or agents will send to the old one."
        >
          <div className="space-y-4">
            <Field
              label="Deposit address"
              name="usdtDepositAddress"
              defaultValue={settings.usdtDepositAddress}
              hint="Check this character by character before saving."
            />
            <Field
              label="Network"
              name="usdtNetwork"
              defaultValue={settings.usdtNetwork}
              hint="Shown beside the address, e.g. TRC20 (Tron)"
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
          title="Startup dialog"
          description="Shown on the sign-in screen before anyone logs in, and closable. The joining amount it quotes is the deposit minimum above, so there is only one number to keep current."
        >
          <div className="space-y-4">
            <Checkbox
              name="welcomeEnabled"
              label="Show the welcome dialog on startup"
              defaultChecked={settings.welcomeEnabled}
            />
            <Field
              label="Title"
              name="welcomeTitle"
              maxLength={120}
              defaultValue={settings.welcomeTitle}
            />
            <Textarea
              label="Message"
              name="welcomeBody"
              rows={5}
              maxLength={2000}
              defaultValue={settings.welcomeBody}
              hint="Line breaks are kept."
            />
          </div>
        </Card>

        <Card
          title="Promotion"
          description="A dismissible banner on the sign-in screen. Leave it off to show nothing."
        >
          <div className="space-y-4">
            <Checkbox
              name="promoEnabled"
              label="Show the promotion"
              defaultChecked={settings.promoEnabled}
            />
            <Field
              label="Headline"
              name="promoHeadline"
              maxLength={160}
              defaultValue={settings.promoHeadline}
              placeholder="Bet on every match, live"
            />
            <Field
              label="Image URL"
              name="promoImageUrl"
              type="url"
              defaultValue={settings.promoImageUrl}
              placeholder="https://…/banner.png"
              hint="Optional. Without one the headline shows on its own."
            />
            <Field
              label="Link URL"
              name="promoLinkUrl"
              type="url"
              defaultValue={settings.promoLinkUrl}
              placeholder="https://1xbet.com"
              hint="Optional. Tapping the banner opens this."
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
