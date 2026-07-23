# Testing Plan

## Coverage goal

Every workspace's test suite enforces a coverage gate of:

```
statements: 90%   branches: 80%   functions: 90%   lines: 90%
```

configured per workspace (`coverageThreshold` in `jest.config.js` for the
Jest-based backend workspaces, `coverage.thresholds` in the Vitest config for
the frontend workspaces) so a workspace's own `test:coverage` script fails
locally the moment it drops below the gate. CI's per-workspace `verify` job
(`.github/workflows/ci.yml`) runs `test:coverage` (not plain `test`) for
this reason — a touched workspace that drops below its gate fails CI, not
just a local check a developer might skip.

`scripts/coverage-report.js` (`npm run coverage:report`) aggregates each
workspace's `coverage/coverage-summary.json` into one repo-wide number to
track separately from any single workspace — see that script's comments for
how the aggregation works and why workspaces without a summary yet are
skipped rather than counted as 0%.

## Rollout status

The gate was enabled workspace-by-workspace, not repo-wide in one pass. As of
this writing:

- **All 8 backend services** (`apps/backend/*`) and **`libs/backend-core`**
  enforce the gate via Jest.
- **`libs/frontend-core`** and **`libs/components`** enforce the gate via
  Vitest.
- **7 of 8 frontend apps** (`apps/frontend/*`) enforce the gate via Vitest:
  account, auth, finance, group, payment, relationship, shell.
- **`album-front` is the one remaining exception.** It has no `coverage`
  block in its Vitest config at all (the other 7 fronts all do), so it never
  emits a `coverage-summary.json` and is skipped by the aggregate report
  rather than failing it. Its actual coverage is far below the 90% goal
  (~17% statements at last check) — pages, hooks, and most services are
  effectively untested. Bringing it to the gate is a substantial testing
  effort on its own, not a config change, and is tracked as separate,
  larger-scoped work rather than folded into incidental fixes.

18 of 19 workspaces are gated; `album-front` is the outstanding one.
