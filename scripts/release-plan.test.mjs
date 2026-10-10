import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageBuild, problems, services } from './image-build.mjs';
import { installSignature } from './release-plan.mjs';

/** A lockfile in the shape npm writes: workspaces by path, packages under node_modules. */
const lock = (packages) => ({ packages });

const base = {
  '': { name: 'root' },
  'apps/frontend/web': {
    dependencies: { '@scope/lib': '1.0.0', react: '^19.0.0' },
    devDependencies: { vite: '^8.0.0' }
  },
  'libs/lib': { name: '@scope/lib', dependencies: { clsx: '^2.0.0' }, devDependencies: { tsc: '^6.0.0' } },
  'node_modules/@scope/lib': { resolved: 'libs/lib', link: true },
  'node_modules/react': { version: '19.3.0', integrity: 'sha-react', dependencies: { scheduler: '^0.27.0' } },
  'node_modules/scheduler': { version: '0.27.0', integrity: 'sha-scheduler' },
  'node_modules/clsx': { version: '2.1.1', integrity: 'sha-clsx' },
  'node_modules/vite': { version: '8.0.1', integrity: 'sha-vite', dependencies: { rollup: '^4.0.0' } },
  'node_modules/rollup': { version: '4.63.3', integrity: 'sha-rollup' },
  'node_modules/tsc': { version: '6.0.3', integrity: 'sha-tsc' },
  'node_modules/unrelated': { version: '1.0.0', integrity: 'sha-unrelated' }
};

const names = (signature) => signature.map((entry) => entry.split('#')[0]);

test('an app installs its dependencies, its dev tooling, and what its library needs', () => {
  const signature = installSignature(lock(base), 'apps/frontend/web', ['libs/lib']);
  assert.deepEqual(names(signature), [
    'clsx@2.1.1',
    'react@19.3.0',
    'rollup@4.63.3',
    'scheduler@0.27.0',
    'tsc@6.0.3',
    'vite@8.0.1'
  ]);
});

test('a package nothing reaches does not affect the app', () => {
  const before = installSignature(lock(base), 'apps/frontend/web', ['libs/lib']);
  const after = installSignature(
    lock({ ...base, 'node_modules/unrelated': { version: '2.0.0', integrity: 'sha-other' } }),
    'apps/frontend/web',
    ['libs/lib']
  );
  assert.deepEqual(after, before);
});

test('a transitive bump changes the signature', () => {
  const before = installSignature(lock(base), 'apps/frontend/web', ['libs/lib']);
  const after = installSignature(
    lock({ ...base, 'node_modules/scheduler': { version: '0.27.1', integrity: 'sha-scheduler-2' } }),
    'apps/frontend/web',
    ['libs/lib']
  );
  assert.notDeepEqual(after, before);
});

test('dev dependencies of a dependency are not installed', () => {
  const withDev = {
    ...base,
    'node_modules/react': { ...base['node_modules/react'], devDependencies: { jest: '^30.0.0' } },
    'node_modules/jest': { version: '30.0.0', integrity: 'sha-jest' }
  };
  assert.ok(!names(installSignature(lock(withDev), 'apps/frontend/web', ['libs/lib'])).includes('jest@30.0.0'));
});

test('a nested copy is found before a hoisted one', () => {
  const nested = {
    ...base,
    'node_modules/vite/node_modules/rollup': { version: '3.0.0', integrity: 'sha-rollup-old' }
  };
  const signature = names(installSignature(lock(nested), 'apps/frontend/web', ['libs/lib']));
  assert.ok(signature.includes('rollup@3.0.0'));
  assert.ok(!signature.includes('rollup@4.63.3'));
});

test('an app that is not in the lockfile has no signature', () => {
  assert.equal(installSignature(lock(base), 'apps/frontend/missing', []), null);
  assert.equal(installSignature(null, 'apps/frontend/web', []), null);
});

test('every app is described for its image', () => {
  assert.deepEqual(problems(), []);
});

test('a backend gets its port and a front gets the shell version', () => {
  assert.equal(imageBuild('album-service').args.PORT, '4002');
  assert.equal(imageBuild('shell-front', { version: '1.2.3' }).args.APP_VERSION, '1.2.3');
  assert.equal(imageBuild('relationship-front', { version: '1.2.3' }).args.APP_VERSION, undefined);
});

test('an unknown service is an error, not an empty build', () => {
  assert.throws(() => imageBuild('nope'), /Unknown service/);
});

test('every app builds from exactly one shared Dockerfile', () => {
  const files = new Set(services().map((service) => imageBuild(service.name).file));
  assert.deepEqual([...files].sort(), ['docker/Dockerfile.back', 'docker/Dockerfile.front']);
});
