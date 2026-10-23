#!/usr/bin/env bash
# Install DSH Projects bundle into a DSH profile.
# Prereqs: Node >= 22, pnpm 11, DSH CLI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH_BIN="${DSH_BIN:-/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh}"
PROFILE="${PROFILE:-projects}"
PROJECTS_HOME="${DSH_PROJECTS_HOME:-$HOME/.dsh/projects-ui}"
DEMO_DIR="$PROJECTS_HOME/hello-project"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm || true)}"
[ -n "$NODE_BIN" ] || { echo "node not found; set NODE_BIN"; exit 1; }
[ -n "$PNPM_BIN" ] || { echo "pnpm not found; set PNPM_BIN"; exit 1; }

echo "==> DSH profile: $PROFILE"
if [ ! -d "$HOME/.dsh/profiles/$PROFILE" ]; then
  "$DSH_BIN" --profile "$PROFILE" --from-default-profile web --dump-config >/dev/null
  echo "    created profile from web template"
fi

echo "==> projects home: $PROJECTS_HOME"
mkdir -p "$PROJECTS_HOME"
if [ ! -d "$DEMO_DIR" ]; then
  cp -R "$ROOT/examples/hello-project" "$DEMO_DIR"
  echo "    created sample project $DEMO_DIR"
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$ROOT/bundle" "$STAGE/bundle"
python3 - "$STAGE/bundle/cordis.patch.yml" "$PROJECTS_HOME" <<'PY'
import sys
p, home = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read().replace('__PROJECTS_HOME__', home)
open(p, 'w', encoding='utf-8').write(s)
PY

echo "==> packing bundle"
( cd "$STAGE/bundle" && "$NODE_BIN" "$PNPM_BIN" pack --pack-destination "$STAGE" >/dev/null )
TARBALL="$(ls "$STAGE"/*.tgz | head -1)"
echo "    $TARBALL"

echo "==> installing into profile $PROFILE"
"$DSH_BIN" plugin --profile "$PROFILE" remove @dsh-projects/app-bundle >/dev/null 2>&1 || true
"$DSH_BIN" plugin --profile "$PROFILE" add "$TARBALL" >/dev/null

cat <<MSG

Installed. Start the web preview with:
  "$DSH_BIN" --profile $PROFILE --no-open --port 61990
Then open the printed URL (contains a one-time token).
MSG
