#!/bin/bash

# Builds test/edge, a Next 15 app whose middleware runs on the Edge runtime, against this working
# tree packed the way npm serves it. webpack's Edge build refuses any node: import the proxy reaches.
#
#   ./scripts/edge-build.sh

set -euo pipefail

cd "$(dirname "$0")/.."
pnpm run build
packed=$(mktemp -d)
work=$(mktemp -d)
trap 'rm -rf "$packed" "$work"' EXIT
pnpm pack --pack-destination "$packed" > /dev/null
cp -r test/edge/. "$work"
cd "$work"
npm install --no-audit --no-fund "$packed"/*.tgz
NEXT_TELEMETRY_DISABLED=1 npx next build
