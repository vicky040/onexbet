# 1XBET agent admin

The admin panel for the agent network, and the REST API the Flutter app in
`../lib` consumes. Next.js 16 (App Router), Postgres via Prisma 7, Tailwind 4.

- **API reference:** [`docs/API.md`](docs/API.md)
- **Wiring the Flutter app up:** [`docs/FLUTTER.md`](docs/FLUTTER.md)

## Run it

You need Node 20+ and a Postgres 14+ database.

```sh
cp .env.example .env.local      # then fill in DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate              # creates the schema
npm run db:seed                 # first admin + demo agent
npm run dev                     # http://localhost:3000
```

Generate `AUTH_SECRET` with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No Postgres to hand? One container is enough:

```sh
docker run -d --name onexbet-postgres \
  -e POSTGRES_USER=onexbet -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=onexbet \
  -p 5433:5432 --restart unless-stopped postgres:16-alpine
```

…with `PGPASS` set to anything you like, then point `DATABASE_URL` at
`postgresql://onexbet:<that password>@localhost:5433/onexbet?schema=public`.

To put this somewhere public instead, see [../DEPLOY.md](../DEPLOY.md).

The seed prints the credentials it created. By default:

| | |
| --- | --- |
| Admin panel | `admin@onexbet.app` / `admin12345` (change `SEED_ADMIN_*` in `.env.local`) |
| Demo agent (mobile app) | `9876543210` / `secret1` |

Set `SEED_DEMO_DATA=false` to seed only the admin. The seed is re-runnable:
it rebuilds the demo agents and their history from scratch each time.

## Scripts

| | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` · `npm start` | production build and serve |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm run smoke` | end-to-end check of both APIs and every page (needs the dev server running; reseeds first) |
| `npm run db:migrate` | create and apply a migration |
| `npm run db:deploy` | apply existing migrations (use this in production) |
| `npm run db:seed` · `npm run db:reset` | seed · drop, re-migrate and re-seed |
| `npm run db:studio` | browse the data in Prisma Studio |

`npm run smoke` is the fastest way to tell whether something is broken:
80 assertions over login, every agent endpoint, every admin endpoint, the
three money paths and all ten panel pages.

```sh
npm run dev                                  # in one terminal
npm run smoke                                # in another
BASE=http://localhost:3001 npm run smoke     # if the dev server picked another port
```

## How it is laid out

```
app/
  (panel)/            the admin UI — dashboard, agents, deposits, payouts,
                      payins, banks, notifications, support, settings, audit
  login/              admin sign-in
  api/v1/             the agent API the Flutter app calls
  api/admin/          the admin API (this panel, scripts, automation)
  actions.ts          server actions behind the panel's forms
components/           UI primitives (ui.tsx), form plumbing (form.tsx), nav
lib/
  operations.ts       every balance change in the system
  auth.ts  tokens.ts  agent bearer tokens, admin session cookie
  validation.ts       zod schemas, mirroring the Flutter validators
  serializers.ts      the agent wire format (matches the Dart models)
  admin-serializers.ts  the richer admin wire format
  stats.ts            dashboard aggregates and weekly earnings
  money.ts            Decimal helpers — no float arithmetic
prisma/
  schema.prisma       the data model
  seed.ts             first admin and demo data
docs/                 API reference, Flutter wiring guide
scripts/smoke.sh      the end-to-end suite
proxy.ts              redirects signed-out visitors away from the panel
```

Two rules keep this from drifting:

**One place changes a balance.** `lib/operations.ts` holds
`approveDeposit`, `rejectDeposit`, `recordPayin`, `acceptPayout`,
`markPayoutPaid`, `settlePayout`, `failPayout` and `adjustBalance`. The REST
API and the panel's server actions both call these — neither has its own
copy of the arithmetic, and each one writes an audit entry and notifies the
agent.

**The panel reads directly, writes through actions.** Pages are server
components querying Prisma (no HTTP hop); forms post to server actions. The
admin REST API covers the same ground for scripts and automation, so a page
and an endpoint always agree.

### Joining plans

A new agent is on no plan (`NONE`) and cannot trade. Their **first** deposit
buys one, and must match its price exactly:

| Plan | Price | What it gives |
| --- | --- | --- |
| Agent | `agentPlanUsdt` (3000) | Payins and payouts |
| Master | `masterPlanUsdt` (5000) | The same, plus a panel account scoped to their referrals |

The plan is recorded on the deposit and only applied when an admin
**approves** it — paying does not promote anyone by itself. Approving a
Master deposit also mints the agent's referral code, which is what new
sign-ups quote to be attached to them.

After joining, deposits are ordinary top-ups: any amount at or above
`minDepositUsdt`, with no plan attached.

### Deposits in two currencies

Bank transfer is **off** by default (`bankTransferEnabled`), so USDT is the
only option the app offers. Turning it on in Settings puts the rupee option
back; until then `POST /deposits` refuses `currency: "INR"` outright rather
than relying on the app to hide it.

An agent can fund their float by bank transfer or by sending USDT.

Balances are always in rupees. A USDT deposit is converted by the **server**
at the rate in Settings, and both the USDT amount and the rate used are
stored on the record, so a later rate change cannot rewrite what someone was
credited. The client sends what it sent; it never decides what it is worth.

One minimum drives both top-ups: `minDepositUsdt` (3000 by default). The rupee
minimum is that valued at `usdtInrRate`, so the two currencies always ask for
the same worth — set the rate to 90 and the rupee floor becomes ₹270,000.

`GET /api/v1/deposits/config` is what the app reads to draw the screen: the
currencies, their minimums, and the USDT address and network. Nothing is
baked into the build, so the address and the floor can move without shipping
a release.

The QR code in the app is a **bundled image** of the address. If you change
`usdtDepositAddress` in Settings, that image must be replaced too, or agents
will scan the old address — the settings screen says so next to the field.

### The ledger

| Event | Agent balance |
| --- | --- |
| Deposit approved | `+ amount` |
| Joining plan approved | `+ price + commission − security` |
| Payin recorded | `+ commission − amount` |
| Payout settled | `+ amount + commission` |

**Payout** is a player putting money in, which the agent collects: the
balance goes up by the amount and the agent earns commission on it.
**Payin** is the app paying a player out through the agent: the balance goes
down by the amount, and the agent still earns commission. Commission is
always paid on top, never deducted from the amount.

A joining plan follows the payout rule, because the agent is the one paying
it in. They earn their **payout** commission on the price, part of the price
is held back as a security deposit, and the rest is float:

    3000 USDT Agent plan, payout rate 2%, 1 USDT = Rs 90

      plan paid        3000 USDT    Rs 2,70,000
      commission 2%      60 USDT    Rs    5,400
      security        -1000 USDT    Rs -90,000
      ----------------------------------------
      balance          2060 USDT    Rs 1,85,400
      security held    1000 USDT

It is written as a settled payout, so it appears in **My Payments** labelled
"Joining plan" and counts towards the earnings screen — which is where an
agent looks to understand where their opening balance came from.

The **Master plan keeps the whole 5000** as security, so a new master opens
with their commission alone as float — the plan buys the panel and the
referral code, not a float to trade with.

The split is set in Settings (`agentPlanSecurityUsdt` 1000,
`masterPlanSecurityUsdt` 5000) and is converted at the rate **stored on the
deposit**, not today's, so it cannot drift if the rate moves before an admin
reviews it.

### Who creates an agent

Only an admin. The app has no sign-up screen, and `signupsEnabled` is off,
so `POST /api/v1/auth/signup` refuses — the switch stays only so the
endpoint can be reopened for app versions already installed.

That makes **Agents → Add an agent** the one way in, which is also where the
agent is put under a master. There is no sign-up to carry a referral code
any more, so a super admin picks the master from a list; a master creating
an agent always gets their own.

An existing agent can be moved with the same picker on their detail page.
Sending `referredById: ""` detaches them, while leaving the field out keeps
them where they are — so an unrelated edit cannot quietly orphan an agent.
An agent cannot be their own master, and only an agent on the Master plan
can be chosen as one. A master may not move agents at all, in or out.

A master's code is minted when their Master deposit is approved and is
shown in the page header on their detail page, so it can be read off
without opening a form.

### Recording in USDT

A payin or a payout can be entered in either currency. Balances are always
in rupees, so a USDT figure is converted by the **server** at the rate in
Settings, and both the original amount and the rate used are stored on the
record — the same rule deposits already follow, so a later rate change can
never rewrite what an agent was credited or charged.

Commission is worked out on the **rupee** value, so a rate change between
two payins does not quietly change the commission on either.

The currency picker sits next to the amount on both forms, and rupees stay
the default. In the tables, a USDT record shows what was handed over under
the rupee figure.

## Who can do what

Three roles, set per panel user under **Panel users** (super admins only):

| | Operator | Super admin | Master |
| --- | --- | --- | --- |
| Read every screen | yes | yes | — |
| Approve / reject deposits | yes | yes | — |
| Create, settle, fail, release payouts | yes | yes | — |
| Record a payin | yes | yes | — |
| Send notifications, answer support | yes | yes | — |
| Create and edit agents, incl. commission rates | — | yes | — |
| Adjust an agent's balance | — | yes | — |
| Correct a payin or payout | — | yes | — |
| Change bank account details, turn them on/off | — | yes | — |
| Edit platform settings and default commissions | — | yes | — |
| Manage panel users | — | yes | — |
| See the agents they referred | — | yes | yes |
| Set those agents' payin/payout commission | — | yes | yes |

A **master** is an agent who bought the Master plan, so their panel account
is tied to their agent record. They see two menu items — Dashboard and
Agents — and both are filtered to the agents who signed up with their
referral code. Within that list the only thing they may change is a
commission rate: not status, not balance, not bank details.

The scope is enforced in the queries, not by hiding rows. A master asking
for an agent they did not refer gets a 404, the same answer as for an agent
that does not exist, so the list cannot be used to discover who else exists.
A master account with no agent attached fails closed.

The gate is enforced on the API and on the server actions behind the forms,
not just by hiding buttons — an operator calling the endpoint directly gets
`403 forbidden`.

Two locks stop a lockout: you cannot remove your own access, and the last
active super admin cannot be demoted or disabled.

**Corrections** re-apply the ledger difference rather than rewriting
history. Correcting a payin moves the agent's balance by the change in
`commission - amount`; correcting a settled payout moves it by the change in
`amount + commission`. The agent is notified and the audit log records the
before and after. Earlier records keep the balance snapshots they had at the
time, because that is what the balance actually was.

## Security notes

- Agents use bearer access tokens (1 h) with rotating refresh tokens (30 d,
  stored only as SHA-256). Admins use an httpOnly session cookie (8 h).
  Both are HS256 JWTs signed with `AUTH_SECRET`, separated by their `aud`
  claim, so an agent token can never reach an admin endpoint.
- Passwords are bcrypt, cost 10. Blocking an agent, changing their password
  or resetting it revokes every refresh token they hold. Access tokens are
  stateless, so a device that already holds one keeps working until it
  expires (`ACCESS_TOKEN_TTL`, 1 hour by default) — see the note under
  `POST /auth/change-password` in docs/API.md if you need instant
  revocation.
- Login tells you nothing about which mobile numbers exist, and a password
  reset answers identically for unknown numbers.
- Every admin action that moves money or changes an account lands in the
  audit log with the admin, a summary and the before/after figures.

**Before going live:**

1. Set a fresh `AUTH_SECRET` and real `SEED_ADMIN_PASSWORD`, and change the
   seeded admin password.
2. Implement `lib/sms.ts` against an SMS gateway — password reset OTPs are
   only logged to the console in development, and the module throws in
   production rather than silently not sending.
3. Serve over HTTPS (the session cookie sets `secure` when
   `NODE_ENV=production`).
4. Put a rate limiter in front of `/api/v1/auth/*`. There is none yet, so
   password guessing is currently only slowed by bcrypt.
5. Decide where deposit screenshots live; `proofUrl` takes a URL but nothing
   uploads files yet.

## Deploying

`npm run build` then `npm start`, with `DATABASE_URL`, `AUTH_SECRET` and
`NODE_ENV=production` set. Run `npm run db:deploy` (not `db:migrate`) as part
of the release to apply migrations.

Prisma 7 talks to Postgres through the `@prisma/adapter-pg` driver adapter,
so the connection string is read at runtime from `DATABASE_URL` (see
`lib/db.ts`) and by the CLI from `prisma.config.ts` — not from
`schema.prisma`, which no longer carries a `url`.
