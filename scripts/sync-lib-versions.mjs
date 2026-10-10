#!/usr/bin/env node
/**
 * Point every workspace that consumes a `libs/*` package at that lib's current
 * version, exactly.
 *
 * Why exact, and why automated:
 *
 * An app depends on a lib by version, and npm links the workspace copy only
 * when that version matches the one in `libs/`. A stale pin makes npm fetch the
 * published package instead, so the app is built and tested against a different
 * lib than the one in the same commit. Images are built from the repository
 * root with the lib compiled from source (docker/Dockerfile.*), which is why the
 * pin has to move with every release: it is what keeps the lockfile, local
 * development, CI and the image all on the same code.
 *
 * An exact version also changes the consumer's package.json on every release,
 * which is what makes the release plan rebuild it.
 *
 * Run automatically by each lib's `npm run release`. `--check` fails instead of
 * writing, for CI.
 *
 *   node scripts/sync-lib-versions.mjs
 *   node scripts/sync-lib-versions.mjs --check
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_DIRS = ['apps/backend', 'apps/frontend', 'libs'];
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

const checkOnly = process.argv.includes('--check');

/** Every workspace package.json path, by convention `<group>/<name>/package.json`. */
const workspaces = () =>
  WORKSPACE_DIRS.flatMap((group) => {
    const groupPath = join(ROOT, group);
    if (!existsSync(groupPath)) {
      return [];
    }
    return readdirSync(groupPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(groupPath, entry.name, 'package.json'))
      .filter(existsSync);
  });

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

const packages = workspaces().map((path) => ({ path, manifest: read(path) }));

// The libs are the publishable source of truth for their own version.
const libVersions = new Map(
  packages
    .filter(({ path }) => path.startsWith(join(ROOT, 'libs')))
    .map(({ manifest }) => [manifest.name, manifest.version])
);

if (libVersions.size === 0) {
  console.error('No libs/* packages found — nothing to sync.');
  process.exit(1);
}

const drifted = [];

for (const { path, manifest } of packages) {
  let changed = false;
  for (const field of DEPENDENCY_FIELDS) {
    for (const [lib, version] of libVersions) {
      // A lib does not pin itself — but it does pin its siblings. Skipping the
      // whole package when it happened to be a lib is what let
      // `@tumbaland/components` keep asking for `@tumbaland/frontend-core: "*"`
      // through every release: it was never examined, so `--check` passed.
      if (lib === manifest.name) {
        continue;
      }
      const current = manifest[field]?.[lib];
      if (current === undefined || current === version) {
        continue;
      }
      drifted.push(`${manifest.name}: ${lib} ${current} → ${version}`);
      manifest[field][lib] = version;
      changed = true;
    }
  }

  if (changed && !checkOnly) {
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

if (drifted.length === 0) {
  console.log('All workspaces already pin the current lib versions.');
  process.exit(0);
}

if (checkOnly) {
  console.error('Lib versions are out of sync — run `npm run sync:libs` and commit:');
  drifted.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}

console.log('Synced lib versions:');
drifted.forEach((line) => console.log(`  ${line}`));
console.log('\nCommit these package.json changes with the release.');
