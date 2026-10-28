-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "agentPlanSecurityUsdt" DECIMAL(14,2) NOT NULL DEFAULT 1000,
ADD COLUMN     "masterPlanSecurityUsdt" DECIMAL(14,2) NOT NULL DEFAULT 2000;
