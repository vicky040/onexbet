-- Agents are created by an admin now, so the public sign-up closes.
ALTER TABLE "Settings" ALTER COLUMN "signupsEnabled" SET DEFAULT false;

-- The default alone would leave the existing row open, which is the whole
-- point of the change: close it for the deployment that is already running.
UPDATE "Settings" SET "signupsEnabled" = false;
