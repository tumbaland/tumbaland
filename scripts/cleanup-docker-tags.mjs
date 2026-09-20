#!/usr/bin/env node
/**
 * Keep the newest semantic-version tags in one Docker Hub repository.
 * `latest` and non-version tags are never considered for deletion.
 */

const [namespace, repository] = process.argv.slice(2);
const keep = Number(process.env.DOCKERHUB_RETAIN ?? 10);
const username = process.env.DOCKERHUB_USERNAME;
const password = process.env.DOCKERHUB_TOKEN;

if (!namespace || !repository || !username || !password || !Number.isInteger(keep) || keep < 1) {
  console.error(
    'usage: DOCKERHUB_USERNAME=... DOCKERHUB_TOKEN=... node scripts/cleanup-docker-tags.mjs <namespace> <repository>'
  );
  process.exit(2);
}

const api = 'https://hub.docker.com/v2';

const responseJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${url} failed (${response.status}): ${body}`);
  }
  return body ? JSON.parse(body) : null;
};

const login = await responseJson(`${api}/users/login/`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password })
});

let next = `${api}/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(repository)}/tags/?page_size=100`;
const tags = [];
while (next) {
  const page = await responseJson(next, { headers: { Authorization: `JWT ${login.token}` } });
  tags.push(...page.results);
  next = page.next;
}

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const versions = tags
  .filter(({ name }) => versionPattern.test(name))
  .sort((left, right) => new Date(right.last_updated) - new Date(left.last_updated));
const deletions = versions.slice(keep);

console.log(`${namespace}/${repository}: ${versions.length} version tags; keeping ${Math.min(keep, versions.length)}`);
for (const tag of deletions) {
  await responseJson(
    `${api}/repositories/${encodeURIComponent(namespace)}/${encodeURIComponent(repository)}/tags/${encodeURIComponent(tag.name)}/`,
    { method: 'DELETE', headers: { Authorization: `JWT ${login.token}` } }
  );
  console.log(`deleted ${tag.name}`);
}
