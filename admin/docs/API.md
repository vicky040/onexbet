# API reference

Two surfaces, one codebase:

| Surface | Prefix | Who calls it | Auth |
| --- | --- | --- | --- |
| Agent API | `/api/v1` | the Flutter app | `Authorization: Bearer <accessToken>` |
| Admin API | `/api/admin` | this panel, scripts, automation | httpOnly session cookie |

An agent token is rejected by the admin API and vice versa: both are HS256
JWTs signed with `AUTH_SECRET` but carry a different `aud` claim.

## Response envelope

Success:

```json
{ "ok": true, "data": { }, "meta": { "page": 1, "perPage": 25, "total": 42, "totalPages": 2 } }
```

`meta` appears on list endpoints only, and some add their own counters
(`unread`, `pendingCount`, `volume`, …).

Failure:

```json
{ "ok": false, "error": { "code": "insufficient_balance", "message": "…", "details": [] } }
```

| `error.code` | HTTP | Meaning |
| --- | --- | --- |
| `bad_request` | 400 | Malformed request or a rule the body broke |
| `unauthorized` | 401 | Missing, expired or unknown token/session |
| `invalid_credentials` | 401 | Wrong password or OTP |
| `forbidden` | 403 | Signed in, but not allowed (blocked or pending agent) |
| `not_found` | 404 | No such record, or it belongs to someone else |
| `conflict` | 409 | Already done, duplicate, or payout already taken |
| `insufficient_balance` | 409 | The change would push a balance below zero |
| `validation_failed` | 422 | Field errors; `details` lists `{ field, message }` |
| `server_error` | 500 | Unexpected; details are logged, not returned |

`validation_failed` details:

```json
{ "ok": false, "error": { "code": "validation_failed", "message": "Some fields are invalid",
  "details": [{ "field": "mobile", "message": "Enter a valid 10-digit mobile number" }] } }
```

## Conventions

- Money is a JSON **number** with two decimals (`5500.5`), never a string.
- Dates are ISO-8601 UTC (`2026-10-27T13:24:53.756Z`); Dart's `DateTime.parse` reads them directly.
- Statuses are upper-snake codes plus a display `statusLabel`:
  `COMPLETED` → "Completed", `PAYMENT_RECEIVED` → "Payment Received",
  `PENDING` → "Pending", `FAILED` → "Failed". These are exactly the four
  cases of `TxnStatus` in the Flutter app.
- In `/api/v1`, a record's `id` **is its reference code** (`APE0Q8VYQV7L`,
  `TXNUGAIDXBWU3`, `LBS0JCLO28RO`) — what the app renders as the record
  title, and what `:reference` path params accept. The admin API uses
  database ids instead and returns the code as `reference`.
- Lists accept `?page=` and `?perPage=` (max 100).

---

# Agent API (`/api/v1`)

## `GET /health`

No auth. Confirms the server is up and Postgres is reachable.

```json
{ "ok": true, "data": { "status": "ok", "database": "reachable", "latencyMs": 3, "time": "…" } }
```

## Authentication

### `POST /auth/login`

```json
{ "mobile": "9876543210", "password": "secret1" }
```

→ `{ "user": {…}, "accessToken": "…", "refreshToken": "…", "expiresIn": 3600, "expiresAt": "…" }`

Wrong mobile and wrong password give the same `invalid_credentials`, so the
response never reveals which numbers are registered. A blocked or
not-yet-approved account gets `forbidden` with a message fit to show the user.

### `POST /auth/signup`

```json
{ "name": "Sam Tester", "mobile": "9876543210", "email": "sam@example.com", "password": "secret1" }
```

→ 201 with the same session fields, plus `pendingApproval`. When the
`requireAgentApproval` setting is on, `accessToken` is `null`,
`pendingApproval` is `true`, and the agent cannot sign in until an admin
activates them. `conflict` if the mobile is taken; `forbidden` when
sign-ups are closed.

### `POST /auth/refresh`

`{ "refreshToken": "…" }` → a new pair. Refresh tokens rotate: the one you
send is revoked, so replaying it returns `unauthorized`. Only a SHA-256 of
each token is stored.

### `POST /auth/logout`

Bearer token required. Optional body `{ "refreshToken": "…" }` revokes that
one device; `{ "all": true }` or no body revokes every session.

### `GET /auth/me`

→ `{ "user": {…}, "summary": {…} }` — backs `AuthRepository.currentUser()`
and saves the app a second call for the dashboard.

### `POST /auth/change-password`

`{ "currentPassword": "…", "newPassword": "…" }`. Revokes every other
device's refresh token and returns a fresh session for this one. Reusing the
current password is refused.

Note that access tokens are stateless JWTs, so another device keeps working
until its current access token expires — up to `ACCESS_TOKEN_TTL` (1 hour by
default). Only its ability to get a *new* one is cut off immediately. Shorten
that window by lowering the TTL, or add a token version column to the agent
and check it on each request if you need instant revocation.

### `POST /auth/password-reset/request`

`{ "mobile": "9876543210" }` → `{ "resetToken": "…", "expiresInMinutes": 10 }`.
Always answers the same whether or not the number exists. Outside
production the response also carries `devOtp` and the code is logged,
because no SMS provider is wired up yet — see `lib/sms.ts`.

### `POST /auth/password-reset/confirm`

`{ "resetToken": "…", "otp": "123456", "newPassword": "…" }`. Five wrong
codes burn the request. Succeeding revokes every refresh token the agent
holds (with the same access-token caveat as changing a password).

## Wallet

### `GET /wallet/summary`

Backs `WalletRepository.summary()`. Every field of the app's
`DashboardSummary`:

```json
{ "totalBalance": 724452.5, "successRate": 100, "securityDepositUsdt": 1000,
  "payinCommission": 5252.5, "payoutCommission": 4100, "totalPayin": 95500,
  "totalDeposit": 605600, "payoutsCredited": 205000 }
```

`successRate` is settled payouts that were received or completed, as a
percentage of all claimed payouts; `0` when there are none yet.

### `GET /wallet/earnings?weeks=8`

Backs `WalletRepository.earnings()`. Newest first, week 1 = the current
week. `maskedTransactions` is the week's payin volume masked the way the
app's earnings table shows it (`9812345623` → `98******23`); `transactions`,
`payinVolume` and the commission split are the real numbers behind it.

```json
[{ "week": 1, "weekStart": "…", "weekEnd": "…", "maskedTransactions": "95**00",
   "netEarnings": 9352.5, "transactions": 9, "payinVolume": 95500,
   "payinCommission": 5252.5, "payoutCommission": 4100 }]
```

## Payins

### `GET /payins`

Backs `WalletRepository.payins()`. Newest first.

```json
[{ "id": "APE0Q8VYQV7L", "reference": "APE0Q8VYQV7L", "createdAt": "…",
   "previousBalance": 530852.5, "amount": 5500, "commissionRate": 5.5,
   "commission": 302.5, "afterBalance": 525655, "txnRef": "628981974812",
   "status": "COMPLETED", "statusLabel": "Completed" }]
```

Payins are created by an admin (or your payment gateway calling the admin
API), never by the app.

## Payouts

### `GET /payouts/open`

Backs `WalletRepository.openPayouts()` — payouts assigned to this agent plus
those offered to everyone.

```json
[{ "id": "LBZ4H9P0C7WE", "amount": 20000, "commission": 400,
   "commissionRate": 2, "upiId": "player@oksbi", "note": null, "createdAt": "…" }]
```

### `GET /payouts/payments?status=`

Backs `WalletRepository.payoutPayments()` — "My Payments". `status` takes
the app's four filter values and maps onto the fuller lifecycle
(`PENDING` covers accepted-but-unpaid; `FAILED` covers cancelled).
`payoutStatus` carries the exact internal state.

### `POST /payouts/:reference/accept`

The agent claims an open payout. Two agents tapping at once: exactly one
wins, the other gets `conflict`.

### `POST /payouts/:reference/paid`

Optional `{ "note": "sent via upi" }`. Reports the player has been paid;
status becomes `PAYMENT_RECEIVED`. **No balance moves yet** — an admin
confirms, and settlement credits amount + commission.

## Deposits

### `GET /deposits`

Backs `WalletRepository.deposits()` — the History tab.

### `GET /deposits/config`

What the Deposit screen needs to draw itself — the currencies, their
minimums and where to send USDT. Read it rather than hardcoding any of it.

```json
{ "usdtInrRate": 90,
  "currencies": [
    { "code": "INR", "label": "Bank transfer", "symbol": "₹",
      "minimum": 270000, "referenceLabel": "UTR / Reference number" },
    { "code": "USDT", "label": "USDT", "symbol": "USDT",
      "minimum": 3000, "referenceLabel": "Transaction hash",
      "address": "TBbwzuMH3nHdYMqft3vNtnvjRtGDVb7LVE",
      "network": "TRC20 (Tron)" }
  ] }
```

The two minimums are always worth the same: the rupee figure is the USDT
minimum valued at `usdtInrRate`.

### `POST /deposits`

```json
{ "amount": 3000, "currency": "USDT", "utr": "<transaction hash>", "proofUrl": "https://…" }
```

`currency` is `INR` (the default) or `USDT`, and `amount` is in that
currency. A USDT deposit is converted to rupees **by the server** at its own
rate; the response carries `amount` (rupees), `amountUsdt` and `usdtRate`,
and the rate is stored so a later change cannot alter what was credited.

`utr` is the bank reference for INR and the chain transaction hash for USDT.

→ 201, status `PENDING`. Nothing is credited until an admin approves (or
when `autoApproveDeposits` is on). Refuses amounts under the minimum for the
chosen currency (`bad_request`) and a reference this agent already used
(`conflict`).

`proofUrl` is optional and must be a URL — this API does not accept file
uploads. The app's screenshot picker needs an upload target (S3, Cloudinary,
UploadThing) before that field carries anything.

## Bank accounts

| | |
| --- | --- |
| `GET /banks` | `BankRepository.banks()` |
| `POST /banks` | `BankRepository.save()` for a new account → 201 |
| `GET /banks/:id` | one account |
| `PATCH /banks/:id` | `BankRepository.save()` for an existing one |
| `PATCH /banks/:id/active` | `BankRepository.setActive()`, body `{ "isActive": true }` |
| `DELETE /banks/:id` | `BankRepository.delete()` |

The wire shape carries **both** `limit` (the key the Dart model reads) and
`dailyLimit` (its real name); either is accepted on write.

```json
{ "id": "…", "bankName": "State Bank of India", "accountHolder": "Sam Tester",
  "accountNumber": "30112233967", "ifsc": "SBIN0001234", "upiId": "demo.sbi@oksbi",
  "limit": 40000, "dailyLimit": 40000, "amountLimit": 40000, "txnLimit": 40000,
  "isActive": true, "createdAt": "…" }
```

Validation matches `lib/core/utils/validators.dart` exactly — same IFSC,
UPI, account-number and mobile rules — so anything the app accepts, the
server accepts.

Another agent's account id returns `not_found`, not `forbidden`, so the API
never confirms that an id exists.

## Notifications

| | |
| --- | --- |
| `GET /notifications` | `InboxRepository.notifications()`; `meta.unread` is the badge count |
| `POST /notifications/:id/read` | `InboxRepository.markRead()` |
| `POST /notifications/read-all` | `InboxRepository.markAllRead()` → `{ "markedRead": 4 }` |

## Support chat

| | |
| --- | --- |
| `GET /support/messages` | `InboxRepository.supportMessages()`, oldest first; opens a new thread with the welcome line |
| `POST /support/messages` | `InboxRepository.sendSupportMessage()`; returns the **whole** conversation, which is what the Dart method expects |

Each message carries `fromUser` (the Dart key) and `fromAgent` (the same
value under its real name).

---

# Admin API (`/api/admin`)

`POST /api/admin/auth/login` with `{ "email", "password" }` sets the session
cookie; everything else needs it. With curl, keep a cookie jar:

```sh
curl -c jar.txt -X POST http://localhost:3000/api/admin/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@onexbet.app","password":"admin12345"}'
curl -b jar.txt http://localhost:3000/api/admin/dashboard
```

| Endpoint | Does |
| --- | --- |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | session |
| `GET /dashboard` | platform totals plus the two review queues |
| `GET /agents?q=&status=` · `POST /agents` | list/search · create |
| `GET /agents/:id` | agent, summary, earnings, banks and recent activity |
| `PATCH /agents/:id` | name, email, status, rates, security deposit, notes, password |
| `POST /agents/:id/balance` | manual correction, `{ "amount": ±n, "reason": "…" }` |
| `GET /deposits?status=&agentId=&q=` | review queue and history |
| `POST /deposits/:id/approve` | **credits the balance**, notifies the agent |
| `POST /deposits/:id/reject` | no balance change; the note reaches the agent |
| `GET /payins?agentId=&q=` · `POST /payins` | list · record one (debits float, pays commission) |
| `GET /payouts?status=&agentId=&q=` · `POST /payouts` | list · create (omit `agentId` to open it to all) |
| `GET /payouts/:id` · `PATCH /payouts/:id` | reassign, release or annotate |
| `POST /payouts/:id/settle` | **credits amount + commission** |
| `POST /payouts/:id/fail` | marks failed, notifies the agent |
| `GET /banks?agentId=&active=&q=` | every agent's accounts |
| `PATCH /banks/:id` · `DELETE /banks/:id` | correct details, switch on/off, remove |
| `GET /notifications?agentId=` · `POST /notifications` | history · send to one agent or `{ "broadcast": true }` |
| `GET /support` · `GET /support/:agentId` · `POST /support/:agentId` | threads · one thread (marks it read) · reply |
| `GET /settings` · `PATCH /settings` | commission defaults, minimum deposit, sign-up and approval rules, welcome message |
| `GET /audit?action=&entity=&entityId=&adminId=` | every money-moving admin action |

`PATCH /payouts/:id` deliberately refuses `status: "COMPLETED"` and will not
touch a settled payout — settling moves money, so it has its own endpoint
and its own audit entry.

## The ledger

Three operations change a balance, and all of them live in
`lib/operations.ts`, which both this API and the panel's forms call:

| Event | Effect on the agent's balance |
| --- | --- |
| Deposit approved | `+ amount` |
| Payin recorded | `+ commission - amount` (their float pays the player's credit) |
| Payout settled | `+ amount + commission` (they paid the player from their own bank) |

Plus `POST /agents/:id/balance` for corrections.

Every change is one atomic `UPDATE … RETURNING`, so two concurrent
operations cannot lose each other's write, and any change that would take a
balance below zero is refused with `insufficient_balance`. Money is
`Decimal(14,2)` end to end — no float arithmetic anywhere.
