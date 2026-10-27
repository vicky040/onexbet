# onexbet

1XBET agent app built with Flutter for Android, iOS and Web, plus the admin panel and API that back it.

The app covers payins, payouts, deposits and bank accounts, using Riverpod for state and go_router for navigation. Every screen reads live data from the backend in [`admin/`](admin/) over its REST API — there is no mock or sample data left in the app, so **the backend has to be running** for it to show anything.

| | |
| --- | --- |
| `lib/`, `android/`, `ios/`, `web/` | the Flutter agent app |
| [`admin/`](admin/README.md) | admin panel + REST API (Next.js, Postgres) |
| [`admin/docs/API.md`](admin/docs/API.md) | every endpoint the app can call |
| [`admin/docs/FLUTTER.md`](admin/docs/FLUTTER.md) | how the app talks to it |

## Run

Start the backend first (see [Admin panel and API](#admin-panel-and-api) below), then:

```sh
flutter pub get
flutter run -d chrome          # web
flutter run                    # connected Android device / emulator
flutter test                   # unit + widget tests
```

**Log in** with the agent the backend seed creates: `9876543210` / `secret1`.
Sign-ups go to the real database, and the session persists across launches.

### Pointing the app at the backend

The default is `http://localhost:3000/api/v1` (`http://10.0.2.2:3000/api/v1`
on Android, which is how the emulator reaches its host). Anything else goes
in at build time:

```sh
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3000/api/v1
```

Debug Android builds are allowed to use plain HTTP to `10.0.2.2` and
`localhost` only (`android/app/src/debug/res/xml/network_security_config.xml`);
add your machine's LAN address there to test on a physical device. Release
builds keep the platform default, so production traffic must be HTTPS.

- **Builds:** run `flutter build apk` or `flutter build web`.
- **iOS:** builds need a Mac with Xcode, for example `flutter build ios --no-codesign`.
- **Android licences:** accept them once with `flutter doctor --android-licenses`.

### Tests

```sh
flutter test                              # everything
flutter test --tags integration           # only the ones that hit the backend
flutter test --exclude-tags integration   # skip them entirely
```

Widget and unit tests run against fake repositories in `test/fakes.dart` and
never touch the network. `test/api_integration_test.dart` drives the real
repositories against a running backend and skips itself when it cannot reach
one, so an offline `flutter test` still passes. If the backend is on another
port:

```sh
API_BASE_URL=http://localhost:3001/api/v1 flutter test
```

## Structure

```
lib/
  core/       config (API base URL), theme, router, formatters, validators,
              shared widgets
  data/
    api/      ApiClient (bearer token, refresh-on-401, error envelope),
              TokenStore, and the four HTTP repositories
    models/   the wire format, each with a fromJson
    repositories/   the interfaces the UI depends on
    providers.dart  wires the HTTP repositories into Riverpod
  features/   auth, shell (bottom nav / rail), home, accounts, payin, payout,
              history, deposit, notifications, profile, support, earnings
```

`lib/data/providers.dart` is the single place that decides where data comes
from. The screens only ever see the four interfaces in
`lib/data/repositories/`, which is why swapping the old mock layer for HTTP
touched no UI code.

## Admin panel and API

The backend is a Next.js app in [`admin/`](admin/README.md). It serves both the
admin panel (agents, deposit approvals, payouts, payins, bank accounts,
notifications, support chat, settings, audit log) and the REST API this app
consumes.

```sh
cd admin
cp .env.example .env.local      # fill in DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

The seed creates an admin (`admin@onexbet.app` / `admin12345`) and a demo
agent (`9876543210` / `secret1`) whose history is built by running the real
ledger operations, so the balances are internally consistent.

## How the app reaches the backend

Four repository interfaces in `lib/data/repositories/` are all the UI knows
about; `lib/data/api/` implements them over HTTP:

| Interface | Endpoints |
| --- | --- |
| `AuthRepository` | `/api/v1/auth/*` |
| `WalletRepository` | `/api/v1/wallet/*`, `/payins`, `/payouts/*`, `/deposits` |
| `BankRepository` | `/api/v1/banks*` |
| `InboxRepository` | `/api/v1/notifications*`, `/api/v1/support/messages` |

`ApiClient` handles the parts every screen would otherwise repeat: the base
URL, the `Authorization: Bearer` header, unwrapping the `{ ok, data }`
envelope, turning `{ ok: false, error }` into an `ApiException` carrying the
server's own message, and refreshing an expired access token once before
giving up. A refresh the server refuses clears the stored tokens and drops
the app back to the login screen; a refresh that fails because the network
blipped leaves the session alone.

Tokens live in `shared_preferences` via `TokenStore`. For a release build,
move them to `flutter_secure_storage` — see
[`admin/docs/FLUTTER.md`](admin/docs/FLUTTER.md).

## Android release build

```sh
flutter build apk --release                  # one APK for all devices
flutter build apk --release --split-per-abi  # smaller APK per CPU type
flutter build appbundle                      # .aab for the Play Store
```

Output goes to `build/app/outputs/`.

Without a keystore, release builds are signed with the debug key. That is fine for sharing and testing, but the Play Store requires a real key. To sign with your own key:

1. Generate it once:

   ```sh
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. Create `android/key.properties` (git-ignored). If `storeFile` is a relative path, it is resolved from `android/app/`.

   ```
   storeFile=<path to upload-keystore.jks>
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```

## App icon and splash

Source images are in `assets/branding/`. After changing them, regenerate:

```sh
dart run flutter_launcher_icons          # launcher icons (flutter_launcher_icons.yaml)
dart run flutter_native_splash:create    # native launch screen (flutter_native_splash.yaml)
```

On launch, the native splash shows the 1XBET logo. The animated Flutter splash in `lib/features/auth/splash_screen.dart` then continues from the same position, with a logo pulse, a shimmer, glow rings, the tagline and a progress bar.

## Fonts

Inter 4.1 is bundled in `assets/fonts` under the SIL Open Font License (`assets/fonts/Inter-LICENSE.txt`).
