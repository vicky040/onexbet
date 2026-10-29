-- Payins and payouts can now be recorded in USDT as well as rupees, so the
-- currency enum is no longer deposit-only. Renamed in place rather than
-- recreated, which would drop the column and its data.
ALTER TYPE "DepositCurrency" RENAME TO "Currency";

ALTER TABLE "Payin"
  ADD COLUMN "currency"   "Currency" NOT NULL DEFAULT 'INR',
  ADD COLUMN "amountUsdt" DECIMAL(14,2),
  ADD COLUMN "usdtRate"   DECIMAL(12,4);

ALTER TABLE "Payout"
  ADD COLUMN "currency"   "Currency" NOT NULL DEFAULT 'INR',
  ADD COLUMN "amountUsdt" DECIMAL(14,2),
  ADD COLUMN "usdtRate"   DECIMAL(12,4);

-- The whole master plan is held as security, leaving no opening float.
-- Only moved where it is still the old default, so a deliberate choice is
-- not overwritten.
ALTER TABLE "Settings" ALTER COLUMN "masterPlanSecurityUsdt" SET DEFAULT 5000;
UPDATE "Settings"
   SET "masterPlanSecurityUsdt" = 5000
 WHERE "masterPlanSecurityUsdt" = 2000;
