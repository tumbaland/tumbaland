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

// libs/* are filtered individually in ci.yml (libs/core, libs/components,
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

if (problems.length) {
  console.error('CI matrix / workspace drift detected:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

console.log(`OK: all ${appWorkspaces.length} app workspaces and ${libWorkspaces.length} libs are covered in ci.yml.`);
