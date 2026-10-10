#!/usr/bin/env node
/**
 * Which image tag each service has to run to be as it was at a release.
 *
 *   DOCKERHUB_USERNAME=… DOCKERHUB_TOKEN=… \
 *     node scripts/resolve-image-tags.mjs <namespace> <version> <service>...
 *
 * Prints { "<service>": "<tag>" | null } as JSON, one entry per service.
 *
 * A release only builds the services that changed, so a service has an image
 * tagged with a version only for the releases that rebuilt it. Going back to
 * 0.0.521 therefore means "the newest tag at or before 0.0.521" for each one:
 * a service last rebuilt at 0.0.517 runs its 0.0.517 image, which is exactly
 * the code it had at 0.0.521. null means no such tag is left, either because
 * the service did not exist yet or because retention pruned it.
 */
import { pathToFileURL } from 'url';

const PLAIN_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

const parts = (version) => PLAIN_VERSION.exec(version)?.slice(1).map(Number) ?? null;

/** Negative when `a` is older than `b`. Both must be plain x.y.z. */
const compare = (a, b) => {
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
};

/** The newest plain x.y.z tag that is not newer than `version`, or null. */
export function newestAtOrBefore(tags, version) {
  const candidates = tags.filter((tag) => parts(tag) && compare(tag, version) <= 0);
  candidates.sort((a, b) => compare(b, a));
  return candidates[0] ?? null;
}

async function main() {
  const [namespace, version, ...services] = process.argv.slice(2);
  const username = process.env.DOCKERHUB_USERNAME;
  const password = process.env.DOCKERHUB_TOKEN;

  if (!namespace || !parts(version ?? '') || services.length === 0 || !username || !password) {
    console.error('usage: DOCKERHUB_USERNAME=… DOCKERHUB_TOKEN=… node scripts/resolve-image-tags.mjs <namespace> <x.y.z> <service>...');
    process.exit(2);
  }

  const api = 'https://hub.docker.com/v2';
  const json = async (url, options = {}) => {
    const response = await fetch(url, options);
    const body = await response.text();
    if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${url} failed (${response.status}): ${body}`);
    return body ? JSON.parse(body) : null;
  };

  const { token } = await json(`${api}/users/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const result = {};
  for (const service of services) {
    let next = `${api}/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(`tumbaland-${service}`)}/tags/?page_size=100`;
    const tags = [];
    while (next) {
      const page = await json(next, { headers: { Authorization: `JWT ${token}` } });
      tags.push(...page.results.map(({ name }) => name));
      next = page.next;
    }
    result[service] = newestAtOrBefore(tags, version);
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
