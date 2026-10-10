import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, ranSuites } from './ci-reuse.mjs';

const run = (overrides) => ({
  id: 1,
  status: 'completed',
  conclusion: 'success',
  event: 'pull_request',
  suites: true,
  ...overrides
});
const job = (name, conclusion) => ({ name, conclusion });

test('a finished run that ran the suites and passed is reused', () => {
  assert.deepEqual(decide([run({ id: 7 })], 99), { action: 'reuse', run: run({ id: 7 }) });
});

test('a green run whose suites were skipped does not vouch for anything', () => {
  assert.equal(decide([run({ id: 7, suites: false })], 99).action, 'run');
});

test('a run never vouches for itself', () => {
  assert.equal(decide([run({ id: 99 })], 99).action, 'run');
});

test('a failed or cancelled run is not reused, and the suites run', () => {
  assert.equal(decide([run({ conclusion: 'failure', suites: undefined })], 99).action, 'run');
  assert.equal(decide([run({ conclusion: 'cancelled', suites: undefined })], 99).action, 'run');
});

test('a run still going is waited for, not duplicated', () => {
  const going = run({ id: 5, status: 'in_progress', conclusion: null, suites: undefined });
  assert.deepEqual(decide([going], 99), { action: 'wait', run: going });
});

test('a finished good run wins over one still going', () => {
  const going = run({ id: 5, status: 'in_progress', conclusion: null, suites: undefined });
  assert.equal(decide([going, run({ id: 7 })], 99).action, 'reuse');
});

test('only runs started by a pull request count', () => {
  assert.equal(decide([run({ event: 'workflow_dispatch' })], 99).action, 'run');
});

test('nothing on the commit means running the suites', () => {
  assert.equal(decide([], 99).action, 'run');
});

test('a real run is recognised by lint and ci-passed both succeeding', () => {
  assert.equal(ranSuites([job('lint', 'success'), job('ci-passed', 'success'), job('verify', 'skipped')]), true);
  assert.equal(ranSuites([job('lint', 'skipped'), job('ci-passed', 'success')]), false);
  assert.equal(ranSuites([job('lint', 'success'), job('ci-passed', 'failure')]), false);
  assert.equal(ranSuites([]), false);
});
