#!/usr/bin/env node
/**
 * Decides what a release has to publish, for .github/workflows/release.yml.
 *
 *   node scripts/release-plan.mjs libs
 *     JSON array of the libs/* packages with publishable changes since their
 *     version last changed, e.g. ["components"].
 *
 *   node scripts/release-plan.mjs services <from> <to>
 *     { "changed": [...], "unchanged": [...] } over every app that ships as an
 *     image, comparing two refs — normally the previous app-v tag and HEAD.
 *
 * An image is built from the repository root against the root lockfile (see
 * docker/Dockerfile.*), so it depends on more than its own folder. A service
 * is rebuilt when any of these changed:
 *   - its own files;
 *   - the library it uses (libs/*), which the image builds from source;
 *   - its tier's Dockerfile, or the build arguments docker/services.json gives it;
 *   - what it installs from package-lock.json: the packages reachable from the
 *     app and its library, compared per app so that a bump nobody uses does not
 *     redeploy everything.
 *
 * "Publishable" leaves out what never reaches a package or an image: unit
 * tests, end-to-end suites and Markdown. A change to those alone republishes
 * nothing. Everything else counts, package.json included — which is how a
 * library release reaches its consumers: `sync-lib-versions.mjs` re-pins them,
 * which changes their files, so the same release rebuilds them against it.
 *
 * Unlike Visin, nothing here carries an unchanged image forward to a new
 * version tag: every compose file pins `:latest`, so an image that was not
 * rebuilt is already the one the server will pull.
 *
 * JSON goes to stdout for the workflow; the reasons go to stderr for the log.
 */
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { DOCKERFILES, services as imageServices } from './image-build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const NOT_PUBLISHED = [/(^|\/)__tests__\//, /\.(test|spec)\.[cm]?[jt]sx?$/, /(^|\/)e2e\//, /\.md$/i];

const publishable = (file) => !NOT_PUBLISHED.some((pattern) => pattern.test(file));

const changedFiles = (from, to, dir) =>
  git('diff', '--name-only', from, to, '--', dir).split('\n').filter(Boolean).filter(publishable);

/** Directory names under `group` that contain `marker`, sorted. */
const dirsWith = (group, marker) =>
  readdirSync(join(ROOT, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, group, entry.name, marker)))
    .map((entry) => entry.name)
    .sort();

const describe = (files) => `${files.length} file(s): ${files.slice(0, 5).join(', ')}${files.length > 5 ? ', …' : ''}`;

/**
 * The libs, ordered so a lib is published after anything it depends on.
 *
 * `@tumbaland/components` pins `@tumbaland/frontend-core` exactly, so publishing
 * components first would put a package on npm pinning the version of
 * frontend-core that is about to be replaced — and re-pinning it afterwards
 * cannot reach the tarball that is already published.
 *
 * Alphabetical order happens to get this exactly backwards.
 */
function inDependencyOrder(names) {
  const manifest = (name) => JSON.parse(readFileSync(join(ROOT, 'libs', name, 'package.json'), 'utf8'));
  const byPackageName = new Map(names.map((name) => [manifest(name).name, name]));

  const ordered = [];
  const visiting = new Set();

  const visit = (name) => {
    if (ordered.includes(name) || visiting.has(name)) {
      return; // already placed, or a cycle — leave it where it first landed
    }
    visiting.add(name);
    const pkg = manifest(name);
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const dependency of Object.keys(pkg[field] ?? {})) {
        const sibling = byPackageName.get(dependency);
        if (sibling && sibling !== name) {
          visit(sibling);
        }
      }
    }
    visiting.delete(name);
    ordered.push(name);
  };

  names.forEach(visit);
  return ordered;
}

function libs() {
  const changed = dirsWith('libs', 'package.json').filter((lib) => {
    const dir = `libs/${lib}`;
    // The last commit that touched the version line is the last release; what
    // changed after it is what the next release would ship. Same base the
    // publish workflow uses to derive the bump.
    const base = git('log', '-1', '--format=%H', '-G"version"', '--', `${dir}/package.json`);
    const files = base ? changedFiles(base, 'HEAD', dir) : [`${dir} (never released)`];
    console.error(files.length ? `${lib}: publish — ${describe(files)}` : `${lib}: nothing to publish`);
    return files.length > 0;
  });

  const ordered = inDependencyOrder(changed);
  if (ordered.join() !== changed.join()) {
    console.error(`order: ${ordered.join(' → ')} (a lib publishes after what it depends on)`);
  }
  return ordered;
}

const gitShow = (ref, path) => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null; // the file did not exist at that ref
  }
};

const readJson = (text) => (text === null ? null : JSON.parse(text));

/**
 * What an app installs, as a sorted list of `package=version` (with integrity).
 *
 * Follows npm's own resolution through the lockfile: a dependency is found in the
 * requiring package's own node_modules first, then in each parent's, up to the
 * root. The app and the libraries it links are the roots, with their dev
 * dependencies, because the image builds them; everything below is a plain
 * dependency. A workspace link is followed to its target, so a library's own
 * dependencies are part of the app that uses it.
 */
export function installSignature(lock, appDir, libDirs) {
  const packages = lock?.packages;
  if (!packages || !packages[appDir]) {
    return null;
  }

  const lookup = (from, name) => {
    let base = from;
    for (;;) {
      const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
      if (packages[candidate]) {
        return candidate;
      }
      if (!base) {
        return null;
      }
      const cut = base.lastIndexOf('/node_modules/');
      base = cut === -1 ? '' : base.slice(0, cut);
    }
  };

  const roots = new Set([appDir, ...libDirs]);
  const seen = new Set();
  const out = new Set();
  const queue = [...roots];

  while (queue.length) {
    const key = queue.pop();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const pkg = packages[key];
    if (!pkg) {
      continue;
    }
    if (pkg.link) {
      // A workspace link: the real package lives at `resolved`.
      queue.push(pkg.resolved);
      continue;
    }
    if (!roots.has(key) && !key.startsWith('apps/') && !key.startsWith('libs/')) {
      out.add(`${key.replace(/^.*node_modules\//, '')}@${pkg.version}${pkg.integrity ? `#${pkg.integrity}` : ''}`);
    }
    const fields = ['dependencies', 'optionalDependencies', 'peerDependencies'];
    if (roots.has(key)) {
      fields.push('devDependencies');
    }
    for (const field of fields) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        const target = lookup(key, name);
        if (target) {
          queue.push(target);
        }
      }
    }
  }
  return [...out].sort();
}

/** `libs/<dir>` for each workspace library the app's package.json depends on. */
function libsUsedBy(manifest, libNames) {
  const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
  return Object.keys(deps)
    .filter((name) => libNames.has(name))
    .map((name) => libNames.get(name));
}

function services(from, to) {
  const libNames = new Map(
    dirsWith('libs', 'package.json').map((dir) => [
      JSON.parse(readFileSync(join(ROOT, 'libs', dir, 'package.json'), 'utf8')).name,
      `libs/${dir}`
    ])
  );

  const lockFrom = readJson(gitShow(from, 'package-lock.json'));
  const lockTo = readJson(gitShow(to, 'package-lock.json'));
  const configFrom = readJson(gitShow(from, 'docker/services.json')) ?? {};
  const configTo = readJson(gitShow(to, 'docker/services.json')) ?? {};

  const plan = { changed: [], unchanged: [] };
  for (const app of imageServices()) {
    const reasons = [];

    const own = changedFiles(from, to, app.dir);
    if (own.length) {
      reasons.push(`its files, ${describe(own)}`);
    }

    const manifest = JSON.parse(readFileSync(join(ROOT, app.dir, 'package.json'), 'utf8'));
    const libs = libsUsedBy(manifest, libNames);
    for (const lib of libs) {
      const files = changedFiles(from, to, lib);
      if (files.length) {
        reasons.push(`${lib}, ${describe(files)}`);
      }
    }

    const shared = changedFiles(from, to, DOCKERFILES[app.tier]);
    if (shared.length) {
      reasons.push(DOCKERFILES[app.tier]);
    }

    const argsFrom = JSON.stringify([
      configFrom.ports?.[app.name],
      configFrom.nginx?.[app.name],
      configFrom.versioned?.includes(app.name)
    ]);
    const argsTo = JSON.stringify([
      configTo.ports?.[app.name],
      configTo.nginx?.[app.name],
      configTo.versioned?.includes(app.name)
    ]);
    if (argsFrom !== argsTo) {
      reasons.push('its build arguments in docker/services.json');
    }

    const before = installSignature(lockFrom, app.dir, libs);
    const after = installSignature(lockTo, app.dir, libs);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const added = (after ?? []).filter((entry) => !(before ?? []).includes(entry));
      reasons.push(
        before === null
          ? 'it was not in the lockfile before'
          : `${added.length} installed package(s) changed: ${added.slice(0, 3).join(', ')}${added.length > 3 ? ', …' : ''}`
      );
    }

    console.error(reasons.length ? `${app.name}: build — ${reasons.join('; ')}` : `${app.name}: unchanged`);
    plan[reasons.length ? 'changed' : 'unchanged'].push(app.name);
  }
  return plan;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'libs' && args.length === 0) {
    console.log(JSON.stringify(libs()));
  } else if (command === 'services' && args.length === 2) {
    console.log(JSON.stringify(services(args[0], args[1])));
  } else {
    console.error('usage: release-plan.mjs libs\n       release-plan.mjs services <from-ref> <to-ref>');
    process.exit(2);
  }
}
