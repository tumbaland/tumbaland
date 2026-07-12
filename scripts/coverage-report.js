#!/usr/bin/env node
// Aggregates coverage/coverage-summary.json (Jest and Vitest v8 both emit the
// same shape via their "json-summary" reporter) across every workspace and
// prints one repo-wide percentage — that's the number to track against the
// 90% goal from TESTING_PLAN.md, not any single workspace in isolation.
//
// Workspaces without a coverage-summary.json yet (not reached in the plan's
// phased rollout) are skipped, not treated as 0% — the repo-wide number only
// reflects packages that have actually opted into coverage tracking so far.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { workspaces } = require(path.join(ROOT, 'package.json'));

function expandWorkspaceGlobs(globs) {
  const dirs = [];
  for (const glob of globs) {
    if (glob.endsWith('/*')) {
      const base = glob.slice(0, -2);
      const baseDir = path.join(ROOT, base);
      if (!fs.existsSync(baseDir)) continue;
      for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(path.join(base, entry.name));
      }
    } else {
      dirs.push(glob);
    }
  }
  return dirs;
}

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function main() {
  const workspaceDirs = expandWorkspaceGlobs(workspaces);
  const totals = Object.fromEntries(METRICS.map((m) => [m, { covered: 0, total: 0 }]));
  const rows = [];

  for (const dir of workspaceDirs) {
    const summaryPath = path.join(ROOT, dir, 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) continue;

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const workspaceTotal = summary.total;
    if (!workspaceTotal) continue;

    for (const metric of METRICS) {
      totals[metric].covered += workspaceTotal[metric].covered;
      totals[metric].total += workspaceTotal[metric].total;
    }

    rows.push({
      name: dir,
      statements: workspaceTotal.statements.pct,
      branches: workspaceTotal.branches.pct,
      functions: workspaceTotal.functions.pct,
      lines: workspaceTotal.lines.pct
    });
  }

  if (rows.length === 0) {
    console.log('No coverage/coverage-summary.json found in any workspace yet — nothing to report.');
    return;
  }

  const pct = (metric) => (totals[metric].total === 0 ? 100 : (100 * totals[metric].covered) / totals[metric].total);

  console.log(`Coverage summary (${rows.length}/${workspaceDirs.length} workspaces reporting)\n`);
  const nameWidth = Math.max(...rows.map((r) => r.name.length), 'workspace'.length) + 2;
  console.log(
    'workspace'.padEnd(nameWidth) +
      METRICS.map((m) => m.padStart(11)).join('')
  );
  for (const row of rows.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      row.name.padEnd(nameWidth) + METRICS.map((m) => `${row[m].toFixed(2)}%`.padStart(11)).join('')
    );
  }

  console.log('\n' + '-'.repeat(nameWidth + 11 * METRICS.length));
  console.log(
    'REPO-WIDE'.padEnd(nameWidth) + METRICS.map((m) => `${pct(m).toFixed(2)}%`.padStart(11)).join('')
  );
}

main();
