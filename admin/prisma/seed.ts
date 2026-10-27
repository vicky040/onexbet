import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import {
  approveDeposit,
  createDeposit,
  createPayout,
  acceptPayout,
  markPayoutPaid,
  recordPayin,
  settlePayout,
} from "../lib/operations";
import { formatInr } from "../lib/money";

/**
 * Creates the first admin and, unless SEED_DEMO_DATA=false, a demo agent
 * whose history is built by running the real ledger operations — so the
 * seeded balances are internally consistent rather than hand-written.
 *
 * Re-runnable: the demo agents are removed and rebuilt on each run.
 */

const DEMO_AGENTS = {
  primary: { mobile: "9876543210", name: "Sam Tester", email: "sam@example.com" },
  pending: { mobile: "9811122233", name: "Riya Shah", email: "riya@example.com" },
  blocked: { mobile: "9700055511", name: "Arun Verma", email: "arun@example.com" },
};

async function seedSettings() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@onexbet.app").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";
  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { name, role: "SUPER_ADMIN", isActive: true, passwordHash },
    create: { email, name, role: "SUPER_ADMIN", isActive: true, passwordHash },
  });

  return { admin, email, password };
}

async function seedDemoData(adminId: string) {
  const mobiles = Object.values(DEMO_AGENTS).map((a) => a.mobile);
  // Deleting the agents cascades to their banks, payins, deposits and
  // messages, but a payout offered to everyone has no agent to cascade
  // from — clear those too, or they pile up on every re-run.
  await prisma.agent.deleteMany({ where: { mobile: { in: mobiles } } });
  await prisma.payout.deleteMany({ where: { agentId: null } });

  const passwordHash = await hashPassword("secret1");
  const settings = await prisma.settings.findUniqueOrThrow({
    where: { id: "default" },
  });

  const agent = await prisma.agent.create({
    data: {
      ...DEMO_AGENTS.primary,
      passwordHash,
      status: "ACTIVE",
      payinCommissionRate: 5.5,
      payoutCommissionRate: 2,
      securityDepositUsdt: settings.requiredSecurityDepositUsdt,
      notes: "Demo account created by the seed script.",
    },
  });

  await prisma.agent.create({
    data: {
      ...DEMO_AGENTS.pending,
      passwordHash,
      status: "PENDING",
      notes: "Signed up but not yet approved.",
    },
  });

  await prisma.agent.create({
    data: {
      ...DEMO_AGENTS.blocked,
      passwordHash,
      status: "BLOCKED",
      notes: "Blocked after repeated failed payouts.",
    },
  });

  // Bank accounts, as shown in the Flutter Accounts tab.
  await prisma.bankAccount.createMany({
    data: [
      {
        agentId: agent.id,
        bankName: "State Bank of India",
        accountHolder: "Sam Tester",
        accountNumber: "30112233967",
        ifsc: "SBIN0001234",
        upiId: "demo.sbi@oksbi",
        dailyLimit: 40000,
        amountLimit: 40000,
        txnLimit: 40000,
        isActive: true,
      },
      {
        agentId: agent.id,
        bankName: "Union Bank",
        accountHolder: "Sam Tester",
        accountNumber: "520101000857",
        ifsc: "UBIN0530101",
        upiId: "demo.union@ybl",
        dailyLimit: 500000,
        amountLimit: 100000,
        txnLimit: 500000,
        isActive: true,
      },
      {
        agentId: agent.id,
        bankName: "Axis Bank",
        accountHolder: "Sam Tester",
        accountNumber: "918010049767",
        ifsc: "UTIB0000123",
        upiId: "demo.axis@okaxis",
        dailyLimit: 200000,
        amountLimit: 50000,
        txnLimit: 200000,
      },
      {
        agentId: agent.id,
        bankName: "HDFC Bank",
        accountHolder: "Sam Tester",
        accountNumber: "50100231184412",
        ifsc: "HDFC0000240",
        upiId: "demo.hdfc@okhdfcbank",
        dailyLimit: 300000,
        amountLimit: 75000,
        txnLimit: 300000,
      },
      {
        agentId: agent.id,
        bankName: "ICICI Bank",
        accountHolder: "Sam Tester",
        accountNumber: "002301556120",
        ifsc: "ICIC0000023",
        upiId: "demo.icici@okicici",
        dailyLimit: 150000,
        amountLimit: 60000,
        txnLimit: 150000,
      },
    ],
  });

  const banks = await prisma.bankAccount.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: "asc" },
  });

  // Fund the float with approved deposits.
  for (const amount of [250000, 150000, 205600]) {
    const deposit = await createDeposit({
      agentId: agent.id,
      amount,
      utr: `4289${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0")}`,
    });
    await approveDeposit({ depositId: deposit.id, adminId, note: "Verified" });
  }

  // One deposit left pending so the admin panel has something to review.
  await createDeposit({
    agentId: agent.id,
    amount: 75000,
    utr: "428799001234",
  });

  // Payins spend the float and earn commission.
  for (const [index, amount] of [30000, 15000, 8000, 25000, 12000, 5500].entries()) {
    await recordPayin({
      agentId: agent.id,
      amount,
      txnRef: `62898${(1974812 + index * 1337).toString()}`,
      bankAccountId: banks[index % banks.length]?.id,
      adminId,
    });
  }

  // Settled payouts, so "My Payments" and the earnings table have history.
  for (const amount of [65000, 45000, 95000]) {
    const payout = await createPayout({
      amount,
      upiId: "player.one@okicici",
      agentId: agent.id,
      adminId,
    });
    await acceptPayout({ reference: payout.reference, agentId: agent.id });
    await markPayoutPaid({ reference: payout.reference, agentId: agent.id });
    await settlePayout({ payoutId: payout.id, adminId });
  }

  // One awaiting admin confirmation.
  const reported = await createPayout({
    amount: 30000,
    upiId: "player.two@ybl",
    agentId: agent.id,
    adminId,
  });
  await acceptPayout({ reference: reported.reference, agentId: agent.id });
  await markPayoutPaid({ reference: reported.reference, agentId: agent.id });

  // Two open payouts any agent can claim.
  await createPayout({ amount: 20000, upiId: "player.three@oksbi", adminId });
  await createPayout({ amount: 12500, upiId: "player.four@paytm", adminId });

  // Support thread.
  await prisma.supportMessage.createMany({
    data: [
      {
        agentId: agent.id,
        text: settings.supportWelcomeMessage,
        fromAgent: false,
      },
      {
        agentId: agent.id,
        text: "Hi, when will my pending deposit be credited?",
        fromAgent: true,
      },
    ],
  });

  const fresh = await prisma.agent.findUniqueOrThrow({ where: { id: agent.id } });
  return { agent: fresh };
}

const DEFAULT_SEED_PASSWORD = "admin12345";

/**
 * Seeding a live deployment with demo agents, or with the password that is
 * written in .env.example, would hand anyone who reads this repository an
 * admin account. Fail closed instead.
 */
function guardProduction(wantsDemoData: boolean) {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  if (!isProduction) return;

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password === DEFAULT_SEED_PASSWORD) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD to something private before seeding production.",
    );
  }
  if (password.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be at least 12 characters in production.",
    );
  }
  if (wantsDemoData) {
    throw new Error(
      "Set SEED_DEMO_DATA=false in production — the demo agents share a known password.",
    );
  }
}

async function main() {
  const wantsDemoData =
    (process.env.SEED_DEMO_DATA || "true").toLowerCase() !== "false";
  guardProduction(wantsDemoData);

  await seedSettings();
  const { admin, email, password } = await seedAdmin();
  console.log(`✔ admin ${email}`);

  if (wantsDemoData) {
    const { agent } = await seedDemoData(admin.id);
    console.log(
      `✔ demo agent ${agent.mobile} (password secret1) — balance ${formatInr(agent.balance)}`,
    );
    const counts = await Promise.all([
      prisma.agent.count(),
      prisma.payin.count(),
      prisma.payout.count(),
      prisma.deposit.count(),
      prisma.notification.count(),
    ]);
    console.log(
      `✔ ${counts[0]} agents, ${counts[1]} payins, ${counts[2]} payouts, ${counts[3]} deposits, ${counts[4]} notifications`,
    );
  }

  console.log("\nSign in to the admin panel with:");
  console.log(`  ${email} / ${password}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
