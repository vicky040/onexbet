-- Joining plans, master referrals, and the panel role that goes with them.

CREATE TYPE "AgentPlan" AS ENUM ('NONE', 'AGENT', 'MASTER');
ALTER TYPE "AdminRole" ADD VALUE 'MASTER_ADMIN';

-- An agent's plan, and who brought them in.
ALTER TABLE "Agent"
  ADD COLUMN "plan"         "AgentPlan" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "Agent_referralCode_key" ON "Agent"("referralCode");
CREATE INDEX "Agent_referredById_idx" ON "Agent"("referredById");

ALTER TABLE "Agent"
  ADD CONSTRAINT "Agent_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "Agent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A master's panel account points back at their agent record.
ALTER TABLE "Admin" ADD COLUMN "agentId" TEXT;
CREATE UNIQUE INDEX "Admin_agentId_key" ON "Admin"("agentId");
ALTER TABLE "Admin"
  ADD CONSTRAINT "Admin_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Which plan a deposit is buying, when it is buying one.
ALTER TABLE "Deposit" ADD COLUMN "plan" "AgentPlan";

-- Plan prices, and the switch that keeps bank transfer off for now.
ALTER TABLE "Settings"
  ADD COLUMN "agentPlanUsdt"       DECIMAL(14,2) NOT NULL DEFAULT 3000,
  ADD COLUMN "masterPlanUsdt"      DECIMAL(14,2) NOT NULL DEFAULT 5000,
  ADD COLUMN "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false;
