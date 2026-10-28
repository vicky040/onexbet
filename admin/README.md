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

### Deposits in two currencies

An agent can fund their float by bank transfer or by sending USDT.

Balances are always in rupees. A USDT deposit is converted by the **server**
at the rate in Settings, and both the USDT amount and the rate used are
stored on the record, so a later rate change cannot rewrite what someone was
credited. The client sends what it sent; it never decides what it is worth.

One minimum drives both: `minDepositUsdt` (3000 by default). The rupee
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
| Payin recorded | `+ commission - amount` |
| Payout settled | `+ amount + commission` |

A payin spends the agent's float: a player paid money into the agent's bank
account, the platform credited that player, and the agent keeps a
commission. A payout is the mirror — the agent pays a player out of their
own bank, so the platform owes them the amount back plus commission, which
lands when an admin confirms it.

Money is `Decimal(14,2)` everywhere, arithmetic goes through
`Prisma.Decimal`, and every change is a single atomic
`UPDATE "Agent" SET balance = balance + $1 … RETURNING balance` — so
concurrent operations cannot lose one another's write, and anything that
would take a balance below zero is refused.

## Who can do what

Two roles, set per panel user under **Panel users** (super admins only):

| | Operator | Super admin |
| --- | --- | --- |
| Read every screen | yes | yes |
| Approve / reject deposits | yes | yes |
| Create, settle, fail, release payouts | yes | yes |
| Record a payin | yes | yes |
| Send notifications, answer support | yes | yes |
| Create and edit agents, incl. commission rates | — | yes |
| Adjust an agent's balance | — | yes |
| Correct a payin or payout | — | yes |
| Change bank account details, turn them on/off | — | yes |
| Edit platform settings and default commissions | — | yes |
| Manage panel users | — | yes |

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
