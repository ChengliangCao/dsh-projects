#!/usr/bin/env bash
# Build a release tarball of the repository source (install via scripts/install.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"
NAME="dsh-projects-$(git -C "$ROOT" describe --tags --always 2>/dev/null || date +%Y%m%d)"
git -C "$ROOT" archive --format=tar.gz --prefix="$NAME/" HEAD -o "$OUT/$NAME.tar.gz"
echo "release tarball: $OUT/$NAME.tar.gz"
