-- A deposit can now arrive in rupees or USDT. Balances stay in rupees, so a
-- USDT deposit records what was sent and the rate it was valued at.
CREATE TYPE "DepositCurrency" AS ENUM ('INR', 'USDT');

ALTER TABLE "Deposit"
  ADD COLUMN "currency"   "DepositCurrency" NOT NULL DEFAULT 'INR',
  ADD COLUMN "amountUsdt" DECIMAL(14,2),
  ADD COLUMN "usdtRate"   DECIMAL(12,4);

-- The flat rupee minimum is replaced by a USDT minimum valued at the
-- configured rate, so the two currencies always ask for the same worth.
ALTER TABLE "Settings"
  DROP COLUMN "minDepositAmount",
  ADD COLUMN "minDepositUsdt"     DECIMAL(14,2) NOT NULL DEFAULT 3000,
  ADD COLUMN "usdtInrRate"        DECIMAL(12,4) NOT NULL DEFAULT 90,
  ADD COLUMN "usdtDepositAddress" TEXT NOT NULL DEFAULT 'TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE',
  ADD COLUMN "usdtNetwork"        TEXT NOT NULL DEFAULT 'TRC20 (Tron)';
