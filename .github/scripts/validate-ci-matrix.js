#!/usr/bin/env node
// Guards against apps/backend/*, apps/frontend/*, and libs/* silently getting
// no CI coverage: ci.yml's paths-filter block lists each workspace by hand,
// so a directory added (or removed) without a matching edit there either
// never runs CI or leaves a dead filter key pointing at nothing.
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const ciYml = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const filterKeys = new Set(
  [...ciYml.matchAll(/^ {12}([\w./-]+):\s*$/gm)].map((m) => m[1])
);

function listWorkspaceDirs(globPattern) {
  const base = globPattern.replace(/\/\*$/, '');
  return fs
    .readdirSync(path.join(repoRoot, base), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${base}/${entry.name}`);
}

const actualWorkspaces = pkg.workspaces.flatMap(listWorkspaceDirs).sort();

// libs/* are filtered individually in ci.yml (libs/backend-core,
// libs/frontend-core) but only apps/backend/* and apps/frontend/* are meant
// to appear as their own matrix entries — libs changes fan out via the
// libs-changed anchor instead of a per-lib matrix job.
const appWorkspaces = actualWorkspaces.filter((w) => w.startsWith('apps/'));
const libWorkspaces = actualWorkspaces.filter((w) => w.startsWith('libs/'));

const missingApps = appWorkspaces.filter((w) => !filterKeys.has(w));
const missingLibs = libWorkspaces.filter((w) => !filterKeys.has(w));

const knownAppKeys = [...filterKeys].filter((k) => k.startsWith('apps/'));
const staleAppKeys = knownAppKeys.filter((k) => !appWorkspaces.includes(k));

const problems = [];
if (missingApps.length) {
  problems.push(`Workspaces missing from ci.yml's paths-filter (add a matrix entry): ${missingApps.join(', ')}`);
}
if (missingLibs.length) {
  problems.push(`libs/* missing from ci.yml's paths-filter: ${missingLibs.join(', ')}`);
}
if (staleAppKeys.length) {
  problems.push(`ci.yml filters a workspace that no longer exists on disk (remove the entry): ${staleAppKeys.join(', ')}`);
}

/**
 * Every workspace must expose the scripts the verify job runs.
 *
 * The job invokes them with `--if-present`, so a workspace missing one is
 * silently skipped rather than failing — album-front went without
 * `test:coverage` for exactly that reason, and its thresholds were never
 * enforced despite being configured. A missing script has to be loud, because
 * the symptom of it otherwise is a green tick over work nobody checked.
 */
const REQUIRED_SCRIPTS = ['test', 'test:coverage', 'typecheck', 'lint'];

const missingScripts = [];
for (const workspace of [...appWorkspaces, ...libWorkspaces]) {
  const manifest = path.join(repoRoot, workspace, 'package.json');
  if (!fs.existsSync(manifest)) continue;
  const scripts = JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts ?? {};
  const absent = REQUIRED_SCRIPTS.filter((name) => !scripts[name]);
  if (absent.length) missingScripts.push(`${workspace} (${absent.join(', ')})`);
}

if (missingScripts.length) {
  problems.push(
    `Workspaces missing scripts the verify job runs — they would be skipped silently: ${missingScripts.join('; ')}`
  );
}

/**
 * And every workspace must actually enforce a coverage threshold. A
 * `test:coverage` script that reports a number nothing checks is a slower way
 * of not measuring.
 */
const CONFIG_FILES = ['jest.config.js', 'vite.config.mts', 'vite.config.ts', 'vitest.config.ts'];
const withoutThresholds = [];
for (const workspace of [...appWorkspaces, ...libWorkspaces]) {
  const config = CONFIG_FILES.map((name) => path.join(repoRoot, workspace, name)).find((f) =>
    fs.existsSync(f)
  );
  if (!config) {
    withoutThresholds.push(`${workspace} (no test config found)`);
    continue;
  }
  const text = fs.readFileSync(config, 'utf8');
  if (!/coverageThreshold|thresholds\s*:/.test(text)) {
    withoutThresholds.push(`${workspace} (${path.basename(config)})`);
  }
}

if (withoutThresholds.length) {
  problems.push(
    `Workspaces whose coverage is measured but not enforced: ${withoutThresholds.join(', ')}`
  );
}

if (problems.length) {
  console.error('CI matrix / workspace drift detected:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

console.log(
  `OK: all ${appWorkspaces.length} app workspaces and ${libWorkspaces.length} libs are in ci.yml, ` +
    'expose every script the verify job runs, and enforce a coverage threshold.'
);
