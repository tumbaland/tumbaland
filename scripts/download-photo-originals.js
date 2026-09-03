#!/usr/bin/env node
/**
 * Download every photo original that is not already on disk.
 *
 * The file-service data directory already holds most of the library; this tops
 * it up so the whole collection is local and can be worked on offline. Safe to
 * re-run — a file already present is skipped, so an interrupted run resumes
 * where it stopped.
 *
 *   node scripts/download-photo-originals.js                  # top up from .env
 *   node scripts/download-photo-originals.js --file-env .env.production \
 *        --file-service-url https://file-service.tumbaland.eu
 *   node scripts/download-photo-originals.js --concurrency 16
 *   node scripts/download-photo-originals.js --limit 50       # try a small batch first
 *
 * The database and the file-service live in different env files here: `--env`
 * chooses where MONGODB_URI comes from, `--file-env` where the file-service URL
 * and API key come from (defaulting to the same file), and `--file-service-url`
 * overrides the URL outright — the env files name the in-cluster address, which
 * is not reachable from a workstation.
 *
 * READ-ONLY as far as MongoDB is concerned. It only writes files to disk.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');
const mongoose = require('mongoose');

const REPO_ROOT = path.join(__dirname, '..');

/** The file-service keeps originals under `<dataDir>/<fileId>`, fileId being a path. */
const DEFAULT_DATA_DIR = path.join(REPO_ROOT, 'apps', 'backend', 'file-service', 'data');

/**
 * Parse an env file into a plain object. Deliberately minimal — these files are
 * `KEY=value` lines, and pulling in dotenv for a script would be the tail
 * wagging the dog.
 */
function readEnvFile(envFile) {
  const full = path.isAbsolute(envFile) ? envFile : path.join(REPO_ROOT, envFile);
  if (!fs.existsSync(full)) throw new Error(`env file not found: ${full}`);

  const env = {};
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, '');
  }
  return env;
}

/** `--flag value`, `--flag=value` and bare `--flag` (true), with defaults. */
function parseArgs(argv, defaults = {}) {
  const args = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[token.slice(2)] = argv[++i];
    } else {
      args[token.slice(2)] = true;
    }
  }
  return args;
}

/** Where a photo's original lives on disk, given its stored fileId. */
const localPathFor = (dataDir, fileId) => path.join(dataDir, fileId);

/**
 * Run `worker` over `items` with a fixed number of workers in flight. Keeps
 * memory flat over a few thousand files and stops one slow download from
 * stalling the rest.
 */
async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/** Single-line progress that stays readable when piped to a file. */
function progressReporter(total, label) {
  const isTty = process.stdout.isTTY;
  let done = 0;
  return () => {
    done++;
    if (isTty) {
      process.stdout.write(`\r${label}: ${done}/${total}`);
      if (done === total) process.stdout.write('\n');
    } else if (done % 200 === 0 || done === total) {
      console.log(`${label}: ${done}/${total}`);
    }
  };
}

const args = parseArgs(process.argv.slice(2), {
  env: '.env',
  dataDir: DEFAULT_DATA_DIR,
  concurrency: '8',
  limit: '0',
  retries: '3'
});

const concurrency = Number(args.concurrency);
const limit = Number(args.limit);
const maxRetries = Number(args.retries);
const dataDir = path.resolve(String(args.dataDir));

/**
 * Where to fetch a file from, and how to prove we may.
 *
 * `/internal/*` is only reachable inside the cluster — from a workstation the
 * public ingress answers 403 — so the default is the public signed route, whose
 * token is the same HMAC the file-service issues to browsers:
 * sha256(secret, "download:<fileId>:<expiresMs>").
 */
function buildRequest(auth, baseUrl, fileId) {
  // Each path segment is encoded separately: a fileId is a path, and encoding
  // it whole would turn its slashes into %2F and miss the object.
  const encoded = fileId.split('/').map(encodeURIComponent).join('/');
  const root = baseUrl.replace(/\/$/, '');

  if (auth.mode === 'signed') {
    const expiresMs = Date.now() + 15 * 60 * 1000;
    const token = crypto
      .createHmac('sha256', auth.hmacSecret)
      .update(`download:${fileId}:${expiresMs}`)
      .digest('hex');
    return {
      url: new URL(`${root}/files/download/${encoded}?token=${token}&expires=${expiresMs}`),
      headers: {}
    };
  }

  return {
    url: new URL(`${root}/internal/files/${encoded}`),
    headers: { 'X-Internal-Api-Key': auth.apiKey }
  };
}

/** One GET for a file, resolved as a Buffer. */
function fetchFile(auth, baseUrl, fileId, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const { url: target, headers } = buildRequest(auth, baseUrl, fileId);
    const lib = target.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        method: 'GET',
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.toString('utf8').slice(0, 200)}`));
          } else {
            resolve(body);
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

/** Present and non-empty. A zero-byte file is a previous failure, not a hit. */
function alreadyHave(target) {
  try {
    return fs.statSync(target).size > 0;
  } catch {
    return false;
  }
}

(async () => {
  const env = readEnvFile(String(args.env));
  const fileEnvName = String(args['file-env'] || args.env);
  const fileEnv = fileEnvName === String(args.env) ? env : readEnvFile(fileEnvName);

  const uri = env.MONGODB_URI || process.env.MONGODB_URI;
  const baseUrl =
    args['file-service-url'] ||
    process.env.FILE_SERVICE_URL ||
    fileEnv.FILE_SERVICE_PUBLIC_URL ||
    fileEnv.FILE_SERVICE_URL;
  const apiKey = fileEnv.FILE_SERVICE_API_KEY || process.env.FILE_SERVICE_API_KEY;
  const hmacSecret = fileEnv.FILE_SERVICE_HMAC_SECRET || process.env.FILE_SERVICE_HMAC_SECRET;

  // Signed URLs work from anywhere; the internal API only from inside the
  // cluster. Prefer the one that can actually reach the deployment.
  const mode = String(args.mode || (hmacSecret ? 'signed' : 'internal'));
  const auth = { mode, apiKey, hmacSecret };

  for (const [name, value, source] of [
    ['MONGODB_URI', uri, args.env],
    ['file-service URL', baseUrl, fileEnvName],
    [mode === 'signed' ? 'FILE_SERVICE_HMAC_SECRET' : 'FILE_SERVICE_API_KEY',
      mode === 'signed' ? hmacSecret : apiKey, fileEnvName]
  ]) {
    if (!value) throw new Error(`${name} missing from ${source}`);
  }

  console.log(`db env    : ${args.env}`);
  console.log(`file env  : ${fileEnvName}`);
  console.log(`file svc  : ${new URL(String(baseUrl)).origin}  (${mode})`);
  console.log(`data dir  : ${dataDir}`);

  await mongoose.connect(uri);
  const photos = mongoose.connection.db.collection('photos');

  const docs = await photos
    .find({ minioFileId: { $exists: true, $ne: null } }, { projection: { minioFileId: 1 } })
    .toArray();

  const missing = docs
    .map((doc) => doc.minioFileId)
    .filter((fileId) => !alreadyHave(localPathFor(dataDir, fileId)));

  console.log(`\nphotos with an original : ${docs.length}`);
  console.log(`already on disk         : ${docs.length - missing.length}`);
  console.log(`to download             : ${missing.length}`);

  const targets = limit > 0 ? missing.slice(0, limit) : missing;
  if (targets.length === 0) {
    console.log('\nNothing to do.');
    await mongoose.disconnect();
    return;
  }
  if (limit > 0) console.log(`(--limit ${limit}, so fetching ${targets.length})`);

  const tick = progressReporter(targets.length, 'downloading');
  const failures = [];
  let bytes = 0;

  await mapWithConcurrency(targets, concurrency, async (fileId) => {
    const target = localPathFor(dataDir, fileId);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const buffer = await fetchFile(auth, String(baseUrl), fileId);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // Write beside the target and rename: a run killed mid-download must not
        // leave a truncated file that the next run counts as already present.
        const temp = `${target}.part`;
        fs.writeFileSync(temp, buffer);
        fs.renameSync(temp, target);
        bytes += buffer.length;
        break;
      } catch (error) {
        if (attempt === maxRetries) {
          failures.push({ fileId, error: error.message });
        } else {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }
    tick();
  });

  console.log(`\ndownloaded : ${targets.length - failures.length}`);
  console.log(`bytes      : ${(bytes / 1e9).toFixed(2)} GB`);
  console.log(`failed     : ${failures.length}`);

  if (failures.length > 0) {
    const logPath = path.join(dataDir, 'download-failures.json');
    fs.writeFileSync(logPath, JSON.stringify(failures, null, 2));
    console.log(`failures written to ${logPath}`);
    console.log('Re-running the script retries exactly these — everything else is skipped.');
  }

  await mongoose.disconnect();
})().catch((error) => {
  console.error('ERR', error.message);
  process.exit(1);
});
