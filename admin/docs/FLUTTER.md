# How the Flutter app talks to this API

The agent app reads everything from this backend — the old in-memory mock
layer is gone, so the server has to be running for the app to show anything.
This is how the two fit together, and what is left to harden.

## The seam

`lib/data/providers.dart` is the only file that decides where data comes
from. Screens and controllers depend on the four interfaces in
`lib/data/repositories/`, never on HTTP:

```dart
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => HttpAuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(tokenStoreProvider),
  ),
);
```

| Dart file | Covers |
| --- | --- |
| `lib/data/api/api_client.dart` | base URL, bearer header, envelope, refresh-on-401 |
| `lib/data/api/token_store.dart` | access/refresh tokens in `shared_preferences` |
| `lib/data/api/http_auth_repository.dart` | `/auth/*` |
| `lib/data/api/http_wallet_repository.dart` | `/wallet/*`, `/payins`, `/payouts/*`, `/deposits` |
| `lib/data/api/http_bank_repository.dart` | `/banks*` |
| `lib/data/api/http_inbox_repository.dart` | `/notifications*`, `/support/messages` |
| `lib/core/config/app_config.dart` | which host to call |

## Method-by-method

| Dart | HTTP |
| --- | --- |
| `AuthRepository.currentUser()` | `GET /auth/me`, or null when no token is stored |
| `AuthRepository.login(mobile, password)` | `POST /auth/login` |
| `AuthRepository.signup(…)` | `POST /auth/signup` |
| `AuthRepository.requestPasswordReset(mobile)` | `POST /auth/password-reset/request` |
| `AuthRepository.confirmPasswordReset(…)` | `POST /auth/password-reset/confirm` |
| `AuthRepository.changePassword(current, new)` | `POST /auth/change-password` |
| `AuthRepository.logout()` | `POST /auth/logout`, then clears the tokens |
| `WalletRepository.summary()` | `GET /wallet/summary` |
| `WalletRepository.earnings()` | `GET /wallet/earnings` |
| `WalletRepository.payins()` | `GET /payins` |
| `WalletRepository.openPayouts()` | `GET /payouts/open` |
| `WalletRepository.payoutPayments()` | `GET /payouts/payments` |
| `WalletRepository.deposits()` | `GET /deposits` |
| `WalletRepository.createDeposit(amount, utr)` | `POST /deposits` |
| `BankRepository.banks()` | `GET /banks` |
| `BankRepository.save(bank)` | `POST /banks` when `id` is empty, else `PATCH /banks/:id` |
| `BankRepository.setActive(id, isActive)` | `PATCH /banks/:id/active` |
| `BankRepository.delete(id)` | `DELETE /banks/:id` |
| `InboxRepository.notifications()` | `GET /notifications` |
| `InboxRepository.markRead(id)` | `POST /notifications/:id/read` |
| `InboxRepository.markAllRead()` | `POST /notifications/read-all` |
| `InboxRepository.supportMessages()` | `GET /support/messages` |
| `InboxRepository.sendSupportMessage(text)` | `POST /support/messages` (returns the whole thread) |

## Things worth knowing

**Sessions.** Login and sign-up store an access token (1 h) and a refresh
token (30 d). On a 401 the client refreshes once and retries, so an expired
access token is invisible to the UI. Concurrent 401s share a single refresh.
A refresh the server *refuses* clears the tokens and calls
`onSessionExpired`, which `AuthController` turns into a logged-out state so
the router shows the login screen. A refresh that fails because the network
is down keeps the tokens, so a tunnel does not sign anyone out.

**Server figures win.** `PayinRecord.commission` and `afterBalance`, and
`DepositRecord.afterBalance`, are now fields read from the response rather
than computed in Dart — they are the numbers the ledger and the admin panel
agree on.

**Statuses.** `TxnStatus.fromCode` maps the API's `COMPLETED`,
`PAYMENT_RECEIVED`, `PENDING` and `FAILED` onto the enum, falling back to
`pending` for a status a newer server might add, so an old build cannot
crash on one.

**Sign-up with approval on.** When `requireAgentApproval` is set, the
response carries `pendingApproval: true` and no tokens. The app keeps the
agent logged out and sends them to the login screen with an explanation.

**Password reset is two steps,** because the old single-call reset would
have let anyone with a mobile number take over an account. The screen asks
for the number, then for the 6-digit code with the new password. Until an SMS
provider is implemented in `lib/sms.ts`, the dev server returns the code as
`devOtp` and the app pre-fills it, so the flow can be walked end to end.

**Errors.** `ApiException.message` is the server's own wording, written to
be shown to the user. `HttpAuthRepository` re-throws as `AuthException`,
which the auth screens already catch; the other screens show
`ApiException.toString()`. `details` carries per-field messages on a
`validation_failed`.

## Tests

- `test/fakes.dart` — in-memory repositories for the widget tests. The app
  itself holds no sample data; these stand in for the server.
- `test/api_client_test.dart` — the client's envelope handling, bearer
  header, refresh-on-401, single-flight refresh, and network failures,
  against a scripted `MockClient`.
- `test/api_integration_test.dart` — the real repositories against a running
  backend: login, every read, a deposit, a bank round-trip, the reset flow,
  transparent refresh and session death. It skips itself when the backend is
  unreachable.

```sh
cd admin && npm run dev
flutter test                                        # all of it
API_BASE_URL=http://localhost:3001/api/v1 flutter test   # other port
flutter test --exclude-tags integration             # offline only
```

The widget tests replace `apiClientProvider` with one whose HTTP client
calls `fail()`, so a test that accidentally reaches the network cannot pass
quietly.

## Still to do

- **Token storage.** `shared_preferences` is plain text on disk. Move to
  `flutter_secure_storage` before release; only `TokenStore` changes.
- **Deposit screenshots.** The Deposit screen still picks an image and keeps
  it in memory — nothing uploads it. `POST /deposits` takes a `proofUrl`, so
  this needs an upload target (S3, Cloudinary, UploadThing) and the returned
  URL passed through `createDeposit`.
- **Claiming payouts.** `POST /payouts/:reference/accept` and `/paid` exist
  on the server and are the agent half of the payout flow the admin panel
  settles, but the Payout tab has no buttons for them yet, so the open-payout
  list is read-only.
- **Offline behaviour.** Every screen shows the API error through the
  existing retry view. There is no caching, so the app is blank without a
  connection.
- **Rate limiting.** Nothing throttles `/auth/login`, so password guessing is
  only slowed by bcrypt.
