#!/usr/bin/env node
/**
 * What it takes to build one service's image.
 *
 * Every image is built from the repository root with one of two shared
 * Dockerfiles (docker/Dockerfile.front, docker/Dockerfile.back), so the
 * only per-service facts are a handful of build arguments. They live in
 * docker/services.json, and this turns a service name into the Dockerfile and
 * arguments to build it with. The workflows and a person at a terminal use the
 * same answer.
 *
 *   node scripts/image-build.mjs <service>                 # key=value lines for $GITHUB_OUTPUT
 *   node scripts/image-build.mjs <service> --version 1.2.3 # also pass the release version, where shown
 *   node scripts/image-build.mjs <service> --cli           # a `docker build` command to paste
 *   node scripts/image-build.mjs --check                   # every app is accounted for
 *   node scripts/image-build.mjs --list                    # every service name
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TIERS = { frontend: 'apps/frontend', backend: 'apps/backend' };

/** The shared Dockerfile each tier builds from. */
export const DOCKERFILES = { frontend: 'docker/Dockerfile.front', backend: 'docker/Dockerfile.back' };

const config = JSON.parse(readFileSync(join(ROOT, 'docker/services.json'), 'utf8'));

/** Every app that ships as an image, with its tier. */
export function services() {
  return Object.entries(TIERS).flatMap(([tier, group]) =>
    readdirSync(join(ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, group, entry.name, 'package.json')))
      .map((entry) => ({ name: entry.name, tier, dir: `${group}/${entry.name}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

export function imageBuild(name, { version } = {}) {
  const service = services().find((candidate) => candidate.name === name);
  if (!service) {
    throw new Error(
      `Unknown service "${name}". Known: ${services()
        .map((s) => s.name)
        .join(', ')}`
    );
  }

  const args = { APP: name };
  if (service.tier === 'backend') {
    const port = config.ports?.[name];
    if (!port) {
      throw new Error(`No port for ${name} in docker/services.json`);
    }
    args.PORT = String(port);
  } else {
    if (config.nginx?.[name]) {
      args.NGINX_IMAGE = config.nginx[name];
    }
    if (version && config.versioned?.includes(name)) {
      args.APP_VERSION = version;
    }
  }

  return { ...service, file: DOCKERFILES[service.tier], context: '.', args };
}

/** Problems with docker/services.json relative to the apps on disk. */
export function problems() {
  const found = [];
  const known = new Set(services().map((s) => s.name));
  for (const service of services()) {
    if (!existsSync(join(ROOT, service.dir, 'tsconfig.json'))) {
      continue;
    }
    if (service.tier === 'backend' && !config.ports?.[service.name]) {
      found.push(`${service.name} has no port in docker/services.json`);
    }
    if (service.tier === 'frontend') {
      for (const required of ['nginx.conf', 'docker-entrypoint.sh']) {
        if (!existsSync(join(ROOT, service.dir, required))) {
          found.push(`${service.name} has no ${required}`);
        }
      }
    }
  }
  for (const section of ['ports', 'nginx']) {
    for (const name of Object.keys(config[section] ?? {})) {
      if (!known.has(name)) {
        found.push(`docker/services.json ${section} lists ${name}, which is not an app`);
      }
    }
  }
  for (const name of config.versioned ?? []) {
    if (!known.has(name)) {
      found.push(`docker/services.json versioned lists ${name}, which is not an app`);
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [first, ...rest] = process.argv.slice(2);
  const flag = (name) => rest.includes(name);
  const option = (name) => {
    const at = rest.indexOf(name);
    return at === -1 ? undefined : rest[at + 1];
  };

  if (first === '--list') {
    console.log(
      services()
        .map((s) => s.name)
        .join('\n')
    );
  } else if (first === '--check') {
    const found = problems();
    if (found.length) {
      console.error(found.map((line) => `  ${line}`).join('\n'));
      process.exit(1);
    }
    console.log(`All ${services().length} apps are described.`);
  } else if (first && !first.startsWith('--')) {
    const build = imageBuild(first, { version: option('--version') });
    if (flag('--cli')) {
      const buildArgs = Object.entries(build.args).map(([k, v]) => `--build-arg ${k}=${v}`);
      console.log(['docker build', `-f ${build.file}`, ...buildArgs, `-t ${first}`, build.context].join(' \\\n  '));
    } else {
      console.log(`file=${build.file}`);
      console.log(`context=${build.context}`);
      console.log('build-args<<EOF');
      Object.entries(build.args).forEach(([k, v]) => console.log(`${k}=${v}`));
      console.log('EOF');
    }
  } else {
    console.error('usage: image-build.mjs <service> [--version X] [--cli] | --list | --check');
    process.exit(2);
  }
}
