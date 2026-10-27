#!/usr/bin/env bash
#
# Builds the Flutter web app on Vercel, which has no Flutter SDK of its own.
#
# Set these in the Vercel project (Settings -> Environment Variables):
#   API_BASE_URL     required, e.g. https://onexbet-admin.vercel.app/api/v1
#   FLUTTER_VERSION  optional, defaults to the version below
#
# Vercel project settings:
#   Build Command      bash scripts/vercel-build-web.sh
#   Output Directory   build/web
#   Install Command    (leave empty)
set -euo pipefail

FLUTTER_VERSION="${FLUTTER_VERSION:-3.44.1}"
FLUTTER_HOME="${FLUTTER_HOME:-$HOME/flutter}"
SDK_URL="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"

# Without this the app would be built pointing at localhost and the deployed
# site would silently fail every request. Better to fail the build.
if [ -z "${API_BASE_URL:-}" ]; then
  echo "ERROR: API_BASE_URL is not set." >&2
  echo "Set it to the deployed backend, e.g. https://your-admin.vercel.app/api/v1" >&2
  exit 1
fi

case "$API_BASE_URL" in
  */api/v1) ;;
  *)
    echo "ERROR: API_BASE_URL should end in /api/v1 (got '$API_BASE_URL')." >&2
    exit 1
    ;;
esac

if [ ! -x "$FLUTTER_HOME/bin/flutter" ]; then
  echo "Fetching Flutter $FLUTTER_VERSION…"
  mkdir -p "$(dirname "$FLUTTER_HOME")"
  curl --fail --location --silent --show-error "$SDK_URL" -o /tmp/flutter.tar.xz
  tar -xJf /tmp/flutter.tar.xz -C "$(dirname "$FLUTTER_HOME")"
  rm -f /tmp/flutter.tar.xz
fi

export PATH="$FLUTTER_HOME/bin:$PATH"

# Vercel's build user is not the SDK's owner, which newer Git refuses to
# work with unless told the directory is safe.
git config --global --add safe.directory "$FLUTTER_HOME" || true

flutter --version
flutter config --no-analytics --enable-web
flutter pub get

echo "Building against $API_BASE_URL"
flutter build web --release --dart-define=API_BASE_URL="$API_BASE_URL"

echo "Built build/web:"
ls -la build/web | head -20
