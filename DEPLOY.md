# Deploying to Vercel

## Live

| | |
| --- | --- |
| Admin panel + API | https://onexbet-admin.vercel.app |
| Agent website | https://onexbet-app.vercel.app |
| Database | Neon Postgres (pooled endpoint) |

Both are deployed from the CLI. There is no Git connection yet, so a push
does **not** redeploy — run `vercel --prod` in `admin/` or at the root, or
run `vercel git connect` once in each project to get automatic deploys.

Two Vercel projects out of this one repository:

| Project | Root directory | What it is |
| --- | --- | --- |
| `onexbet-admin` | `admin` | the admin panel **and** the API the app calls |
| `onexbet-app` | repository root | the Flutter web build |

They have to go up in this order, because each needs the other's URL:

1. a Postgres database
2. the admin project (gives you the API URL)
3. the Flutter project, built against that API URL
4. `ALLOWED_ORIGINS` on the admin project, set to the Flutter site's URL

## 1. A database

Vercel's functions cannot reach the Postgres container on your machine, so the
database has to live somewhere public. [Neon](https://neon.tech),
[Supabase](https://supabase.com) and Vercel Postgres all have a free tier.

Take **two** connection strings:

- a **pooled** one for the app — Neon's `...-pooler...` host, or Supabase port
  `6543`. Serverless functions come and go constantly and each one opens
  connections; without a pooler you will run the database out of them.
- a **direct** one for migrations, which cannot run through a pooler.

## 2. The admin project

```
New Project -> import vicky040/onexbet
Root Directory      admin
Framework Preset    Next.js   (detected)
Build Command       npm run build   (detected)
```

Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the **pooled** connection string |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ALLOWED_ORIGINS` | leave empty for now; filled in at step 4 |
| `ACCESS_TOKEN_TTL` | `1h` (optional) |
| `REFRESH_TOKEN_TTL_DAYS` | `30` (optional) |
| `ADMIN_SESSION_TTL` | `8h` (optional) |

Deploy. You now have something like `https://onexbet-admin.vercel.app`.

### Create the schema and the first admin

Run these from your machine against the **direct** connection string — the
Vercel build deliberately does not migrate, so a deploy can never alter the
database on its own.

```sh
cd admin

# Schema. `deploy` applies existing migrations and never invents new ones.
DATABASE_URL="<direct connection string>" npm run db:deploy

# One admin account. SEED_DEMO_DATA=false is required in production: the
# demo agents share a password that is written in this repository.
DATABASE_URL="<direct connection string>" \
NODE_ENV=production \
SEED_DEMO_DATA=false \
SEED_ADMIN_EMAIL="you@yourdomain.com" \
SEED_ADMIN_PASSWORD="<a long private password>" \
SEED_ADMIN_NAME="Your Name" \
npm run db:seed
```

The seed refuses to run in production with demo data, with no
`SEED_ADMIN_PASSWORD`, with the one from `.env.example`, or with one under 12
characters.

Check it:

```sh
curl https://onexbet-admin.vercel.app/api/v1/health
```

→ `{"ok":true,"data":{"status":"ok","database":"reachable",...}}`

Then sign in to the panel at `https://onexbet-admin.vercel.app/login`.

## 3. The Flutter project

```
New Project -> import vicky040/onexbet   (the same repo again)
Root Directory      ./            (the repository root)
Framework Preset    Other
```

`vercel.json` at the root already sets the build command, the output
directory and the SPA rewrite, so the only thing to add is:

| Name | Value |
| --- | --- |
| `API_BASE_URL` | `https://onexbet-admin.vercel.app/api/v1` |
| `ANDROID_APK_URL` | `/downloads/onexbet-agent.apk` (optional) |
| `FLUTTER_VERSION` | `3.44.1` (optional; the build script's default) |

`ANDROID_APK_URL` is what makes **Profile → Download Android app** appear in
the agent app. Leave it unset and the option is simply not shown, so it can
never be a dead link.

`scripts/vercel-build-web.sh` downloads the Flutter SDK and runs
`flutter build web --release --dart-define=API_BASE_URL=…`. It **fails the
build** if `API_BASE_URL` is missing or does not end in `/api/v1`, rather
than shipping a site that quietly talks to localhost.

The first build takes a few minutes: the SDK is a 1.5 GB download.

## 4. Let the browser through

A browser refuses a cross-origin API call unless the API says otherwise. Set
this on the **admin** project and redeploy it:

| Name | Value |
| --- | --- |
| `ALLOWED_ORIGINS` | `https://onexbet-app.vercel.app` |

Comma-separate several (a custom domain, a staging URL). Preview deployments
get a new hostname each time, so add those you care about or use a stable
alias. Without this the native apps keep working and the website shows a
network error on every request.

Verify:

```sh
curl -i https://onexbet-admin.vercel.app/api/v1/health \
  -H "Origin: https://onexbet-app.vercel.app" | grep -i access-control-allow-origin
```

## Deploying from the CLI instead

```sh
npm i -g vercel
vercel login          # interactive: opens a browser

cd admin && vercel --prod        # first run asks the setup questions
cd ..    && vercel --prod
```

`vercel env add DATABASE_URL production` and friends set the variables
without the dashboard. For the Flutter site you can also skip the SDK
download by building locally and uploading the output:

```sh
flutter build web --release \
  --dart-define=API_BASE_URL=https://onexbet-admin.vercel.app/api/v1
cd build/web && vercel --prod
```

That gives up automatic deploys on push.

## Before you call it live

- [ ] `SEED_ADMIN_PASSWORD` was a real password, and `SEED_DEMO_DATA=false`
- [ ] `AUTH_SECRET` is freshly generated and not the one from `.env.example`
- [ ] `DATABASE_URL` points at a **pooled** endpoint
- [ ] `ALLOWED_ORIGINS` lists only hosts you own
- [ ] An SMS provider is implemented in `admin/lib/sms.ts`. Password-reset
      codes are only logged in development, and the module **throws** in
      production rather than pretending to send one.
- [ ] Something rate-limits `/api/v1/auth/*`. There is nothing yet, so
      password guessing is only slowed by bcrypt. Vercel's WAF or an
      Upstash-backed limiter both work.
- [ ] Deposit screenshots have somewhere to go if you want them; `proofUrl`
      takes a URL and nothing uploads files yet.
- [ ] The Android app points at the deployed API over HTTPS:
      `flutter build apk --release --dart-define=API_BASE_URL=https://onexbet-admin.vercel.app/api/v1`
      (the debug cleartext exception only covers localhost).

## Hosting the Android build

The APK is ~54 MB, which does not belong in git, so it is **not** in the
repository. It is served as a static file by the Flutter project:

```sh
# Build it against the deployed API, not localhost.
flutter build apk --release   --dart-define=API_BASE_URL=https://onexbet-admin.vercel.app/api/v1

mkdir -p web/downloads
cp build/app/outputs/flutter-apk/app-release.apk web/downloads/onexbet-agent.apk

# Deploy from the CLI, which uploads the working directory.
vercel --prod
```

`web/` is copied into `build/web` by `flutter build web`, so the file ends up
at `/downloads/onexbet-agent.apk`, and `vercel.json` serves it as
`application/vnd.android.package-archive` so Android offers to install it.

**The catch:** `web/downloads/` is git-ignored, so this only works for a CLI
deploy. If you connect Git for automatic deploys, that file will not be in
the checkout and the link will 404 — the build prints a warning when that
happens. For Git deploys, upload the APK to a GitHub Release instead and
point `ANDROID_APK_URL` at the asset URL.

Without a keystore the release APK is signed with the debug key, which is
fine for sideloading but not for the Play Store; see the Android release
notes in README.md.

## Things that bit during the first deploy

**Do not create the project with `vercel project add` first.** Doing that
sets Framework Preset to *Other*, and Vercel then serves the Next.js output
as if it were a static site: the build succeeds, the route list prints, and
every single URL answers 404 with `x-vercel-error: NOT_FOUND`. Either let
`vercel deploy` create the project (it detects Next.js), or fix it after the
fact:

```sh
echo '{"framework":"nextjs"}' > fw.json
vercel api /v9/projects/onexbet-admin -X PATCH --input fw.json
rm fw.json
```

Then redeploy. Check it with `vercel project inspect`, which prints the
preset. The Flutter project is correctly *Other* — it is a static build
driven by the root `vercel.json`.

**Neon's `channel_binding=require` is not needed.** The connection string
Neon offers includes it, and `node-postgres` prints a libpq-compatibility
warning about `sslmode`. `?sslmode=require` on its own connects fine and
still verifies the certificate, so that is what is set on the deployment.

**Migrations need the direct endpoint.** Strip `-pooler` from the Neon host
for `db:deploy` and `db:seed`; a pooled connection cannot run them.

## Things that will bite otherwise

**Migrations are not part of the build.** `npm run build` runs
`prisma generate && next build` only. Run `npm run db:deploy` yourself when a
release contains a migration, before promoting it:

```sh
cd admin
DATABASE_URL="<direct connection string>" npm run db:deploy
```

**The admin API has no CORS and needs none** — the panel calls it from its
own origin. Only `/api/v1` is opened up, and only to `ALLOWED_ORIGINS`.

**Function regions.** Put the admin project in the region nearest the
database (Vercel: Settings → Functions → Region), or every query pays the
round trip twice.

**`vercel.json` at the root belongs to the Flutter project.** The admin
project has Root Directory `admin`, so it never sees that file.
