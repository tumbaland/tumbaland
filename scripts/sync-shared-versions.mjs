#!/usr/bin/env node
/**
 * Keep every front on one exact version of what the shell shares with its modules.
 *
 * Why this exists:
 *
 * The shell and each module are separate images, built at different times. An
 * image installs with `npm i` inside its own Dockerfile, which never sees the
 * root lockfile, so a caret range resolves to whatever was newest on the day of
 * that build. At runtime the module-federation host hands its own copy of
 * react, @mui/material and the rest to every module (see
 * `libs/frontend-core/src/federation.ts`). The shell was rebuilt the day after
 * MUI 9.5.0 came out; the modules were still on 9.4.0. A module's theme, built
 * by its bundled 9.4.0, was then rendered by the shell's 9.5.0 inputs, which
 * read a palette key that 9.4.0 does not have, and Journal, Money and Profile
 * stopped loading. Every test passed: tests run against the lockfile, where
 * everything agreed.
 *
 * So the versions that cross that boundary are exact, identical in every front,
 * and the same as the lockfile CI tests against. Changing one is one pull
 * request that touches every front, which is also what makes the release
 * rebuild them all together.
 *
 * What is pinned:
 *  - every package in TUMBALAND_FEDERATION_SHARED, plus @mui/icons-material
 *    (it must be the same release as @mui/material);
 *  - the MUI packages @mui/material itself depends on with a caret range
 *    (`overrides`, so a fresh install cannot float them past the pinned one).
 *
 * To upgrade: `npm update <package>`, then `npm run sync:shared`, then
 * `npm install`, and commit all of it. `--check` fails instead of writing, for CI.
 *
 *   node scripts/sync-shared-versions.mjs
 *   node scripts/sync-shared-versions.mjs --check
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTENDS = join(ROOT, 'apps/frontend');
const FEDERATION = join(ROOT, 'libs/frontend-core/src/federation.ts');
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'];

/** Installed next to @mui/material, and moved by the same release. */
const MUI_COMPANIONS = ['@mui/icons-material'];

/** What @mui/material depends on with `^`: pinned through `overrides`. */
const MUI_TRAIN = [
  '@mui/core-downloads-tracker',
  '@mui/private-theming',
  '@mui/styled-engine',
  '@mui/system',
  '@mui/types',
  '@mui/utils'
];

const EXACT = /^\d+\.\d+\.\d+$/;
const checkOnly = process.argv.includes('--check');

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** The package names between `TUMBALAND_FEDERATION_SHARED = {` and its `};`. */
function sharedNames() {
  const source = readFileSync(FEDERATION, 'utf8');
  const block = source.match(/TUMBALAND_FEDERATION_SHARED\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) {
    console.error(`Could not find TUMBALAND_FEDERATION_SHARED in ${FEDERATION}`);
    process.exit(1);
  }
  return [...block[1].matchAll(/^\s*['"]?(@?[\w./-]+)['"]?\s*:\s*\{/gm)].map((match) => match[1]);
}

const lock = read(join(ROOT, 'package-lock.json')).packages;
const installed = (name) => lock[`node_modules/${name}`]?.version;

const pinned = [...sharedNames(), ...MUI_COMPANIONS];

const fronts = readdirSync(FRONTENDS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(FRONTENDS, entry.name, 'package.json'))
  .filter(existsSync)
  .map((path) => ({ path, manifest: read(path) }));

if (fronts.length === 0) {
  console.error('No apps/frontend/* packages found — nothing to sync.');
  process.exit(1);
}

const drifted = [];
const unresolved = new Set();

for (const { path, manifest } of fronts) {
  let changed = false;
  const name = manifest.name ?? path;

  for (const field of DEPENDENCY_FIELDS) {
    for (const dep of pinned) {
      const current = manifest[field]?.[dep];
      if (current === undefined) {
        continue;
      }
      const version = installed(dep);
      if (!version) {
        unresolved.add(dep);
        continue;
      }
      if (current !== version) {
        drifted.push(`${name}: ${dep} ${current} → ${version}`);
        manifest[field][dep] = version;
        changed = true;
      }
    }
  }

  // Only a front that uses MUI needs its companions held back.
  const usesMui = DEPENDENCY_FIELDS.some((field) => manifest[field]?.['@mui/material']);
  if (usesMui) {
    manifest.overrides ??= {};
    for (const dep of MUI_TRAIN) {
      const version = installed(dep);
      if (!version) {
        unresolved.add(dep);
        continue;
      }
      if (manifest.overrides[dep] !== version) {
        drifted.push(`${name}: overrides ${dep} ${manifest.overrides[dep] ?? '(none)'} → ${version}`);
        manifest.overrides[dep] = version;
        changed = true;
      }
    }
  }

  if (changed && !checkOnly) {
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

if (unresolved.size > 0) {
  console.error(`Not in package-lock.json, so there is nothing to pin to: ${[...unresolved].join(', ')}`);
  process.exit(1);
}

// What was written is exact by construction, but a lockfile entry can be a
// range only if someone hand-edited it; say so rather than pin a range.
const inexact = [
  ...new Set([...pinned, ...MUI_TRAIN].map((dep) => [dep, installed(dep)]).filter(([, v]) => v && !EXACT.test(v)))
];
if (inexact.length > 0) {
  console.error('Lockfile versions that are not plain x.y.z:', inexact.map(([d, v]) => `${d}@${v}`).join(', '));
  process.exit(1);
}

if (drifted.length === 0) {
  console.log('Every front pins the shared versions the lockfile resolves.');
  process.exit(0);
}

if (checkOnly) {
  console.error('Shared versions are out of sync with the lockfile — run `npm run sync:shared` and commit:');
  drifted.forEach((line) => console.error(`  ${line}`));
  console.error(
    '\nThe shell and the modules are separate images that share these packages at runtime, so they\n' +
      'must be the same version in every front. See the header of scripts/sync-shared-versions.mjs.'
  );
  process.exit(1);
}

console.log('Synced shared versions:');
drifted.forEach((line) => console.log(`  ${line}`));
console.log('\nRun `npm install` to refresh package-lock.json, then commit both.');
