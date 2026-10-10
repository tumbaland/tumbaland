#!/usr/bin/env node
/**
 * Lets "Ready for review" reuse the run the draft already had, instead of
 * starting the whole pipeline again.
 *
 * A pull request is tested while it is a draft: every push runs the suites. Marking
 * it ready used to run them all a second time on the same commit, which is a full
 * run of ~40 jobs, several on ARM, for no new information. This is the check the
 * `gate` job in ci.yml runs first on that event:
 *
 *   - a finished run of this workflow on the same commit that really ran the
 *     suites and passed: reuse it, skip the suites, go straight to the merge;
 *   - one still running: wait for it, then decide again;
 *   - none (the PR was opened ready, or its last run failed or was cancelled): run
 *     the suites. A red commit is never merged on the strength of nothing.
 *
 * "Really ran the suites" is read from the jobs, not from the conclusion: a run
 * that itself reused another one is green with its suites skipped, and must not
 * vouch for anything. `lint` is never skipped on a real run, so `lint` and
 * `ci-passed` both succeeding is what counts.
 *
 *   GITHUB_TOKEN=… node scripts/ci-reuse.mjs --repo owner/name --sha <head> \
 *     --run <this run id> [--wait-minutes 45]
 *
 * Writes `reuse=true|false` and `run=<id>` to $GITHUB_OUTPUT.
 */
import { appendFileSync } from 'fs';
import { fileURLToPath } from 'url';

const REAL_RUN_JOBS = ['lint', 'ci-passed'];

/** Did these jobs come from a run that actually executed the suites and passed? */
export function ranSuites(jobs) {
  return REAL_RUN_JOBS.every((name) => jobs.some((job) => job.name === name && job.conclusion === 'success'));
}

/**
 * What a ready-for-review run should do.
 *
 * @param runs  workflow runs for the commit, each with `suites` set for completed
 *              successful ones (see ranSuites)
 * @param currentRunId  this run, which must not vouch for itself
 * @returns {{action: 'reuse'|'wait'|'run', run?: object}}
 */
export function decide(runs, currentRunId) {
  const others = runs.filter((run) => run.id !== currentRunId && run.event === 'pull_request');

  const reusable = others.find(
    (run) => run.status === 'completed' && run.conclusion === 'success' && run.suites === true
  );
  if (reusable) {
    return { action: 'reuse', run: reusable };
  }

  const inFlight = others.find((run) => run.status !== 'completed');
  if (inFlight) {
    return { action: 'wait', run: inFlight };
  }

  return { action: 'run' };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at === -1 ? fallback : args[at + 1];
  };

  const repo = option('--repo');
  const sha = option('--sha');
  const currentRunId = Number(option('--run'));
  const waitMinutes = Number(option('--wait-minutes', '45'));
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  if (!repo || !sha || !currentRunId || !token) {
    console.error('usage: GITHUB_TOKEN=… ci-reuse.mjs --repo owner/name --sha <sha> --run <id> [--wait-minutes N]');
    process.exit(2);
  }

  const api = async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }
    });
    if (!response.ok) {
      throw new Error(`GET ${path} failed (${response.status}): ${await response.text()}`);
    }
    return response.json();
  };

  const finish = (reuse, run) => {
    console.log(reuse ? `Reusing run ${run.id} (${run.html_url}).` : 'Running the suites.');
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${reuse}\nrun=${run?.id ?? ''}\n`);
    }
  };

  const deadline = Date.now() + waitMinutes * 60_000;
  for (;;) {
    const { workflow_runs: found } = await api(`actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=50`);

    const runs = [];
    for (const run of found) {
      let suites;
      if (run.id !== currentRunId && run.status === 'completed' && run.conclusion === 'success') {
        const { jobs } = await api(`actions/runs/${run.id}/jobs?per_page=100`);
        suites = ranSuites(jobs);
      }
      runs.push({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        html_url: run.html_url,
        suites
      });
    }

    const decision = decide(runs, currentRunId);
    if (decision.action === 'reuse') {
      return finish(true, decision.run);
    }
    if (decision.action === 'run') {
      return finish(false);
    }
    if (Date.now() > deadline) {
      console.log(`Run ${decision.run.id} is still going after ${waitMinutes} minutes; running the suites instead.`);
      return finish(false);
    }
    console.log(`Waiting for run ${decision.run.id} on this commit (${decision.run.html_url})…`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
