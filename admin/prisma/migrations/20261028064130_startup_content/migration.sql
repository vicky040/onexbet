-- What the app shows on startup, before anyone signs in: an explanatory
-- dialog and an optional dismissible promotion. All defaulted, so existing
-- rows get sensible values.
ALTER TABLE "Settings"
  ADD COLUMN "welcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "welcomeTitle"   TEXT NOT NULL DEFAULT 'Welcome to 1XBET Agent',
  ADD COLUMN "welcomeBody"    TEXT NOT NULL DEFAULT '1XBET agents collect player deposits and pay out withdrawals through their own bank accounts, earning commission on every transaction. Your balance is the float you work with: top it up, and it is credited once we have verified the payment.',
  ADD COLUMN "promoEnabled"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promoHeadline"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN "promoImageUrl"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN "promoLinkUrl"   TEXT NOT NULL DEFAULT '';
