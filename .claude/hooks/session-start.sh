#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
#
# Web sessions start from a fresh clone with no node_modules and no built
# shared libs, so `npm run lint` / `typecheck` / `test` fail cold. This
# provisions the workspace so those commands work out of the box.
#
# Local dev environments manage their own setup, so this is a no-op there.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install every workspace's dependencies. `npm install` (not `npm ci`) so the
# cached container state is reused across sessions instead of wiping
# node_modules each time.
npm install

# Build the three shared @tumbaland/* libs so apps can typecheck and test
# against their emitted dist + .d.ts. Order matters: components imports from
# frontend-core, so frontend-core must be built before components. Mirrors the
# CI `build-libs` step in .github/workflows/ci.yml.
npm run build -w @tumbaland/backend-core -w @tumbaland/frontend-core -w @tumbaland/components
