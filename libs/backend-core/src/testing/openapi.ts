import fs from 'fs';
import nodePath from 'path';
import express, { type Application } from 'express';
import { parse } from 'yaml';

/**
 * Checks a service's hand-written `docs/openapi.yml` against the routes the app
 * really registers, so the two cannot drift apart unnoticed. The spec stays the
 * place where the API is explained; this only proves it is complete.
 *
 * Express 5 does not keep the path a router was mounted at, so
 * `recordMountPaths()` notes it as routers are mounted. It runs from the test
 * setup file (`@tumbaland/backend-core/testing`), before any app is built.
 */

interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
  mountPath?: string | string[];
}

interface Stacked {
  stack: Layer[];
}

let recording = false;

/** Makes every `use()` remember its path on the layers it adds. Idempotent. */
export function recordMountPaths(): void {
  if (recording) return;
  recording = true;
  const proto = (express.Router as unknown as { prototype: { use: (...args: unknown[]) => unknown } }).prototype;
  const use = proto.use;
  proto.use = function (this: Stacked, ...args: unknown[]) {
    const before = this.stack.length;
    const result = use.apply(this, args);
    const first = args[0];
    const mountPath = typeof first === 'string' || Array.isArray(first) ? (first as string | string[]) : '/';
    for (const layer of this.stack.slice(before)) layer.mountPath = mountPath;
    return result;
  };
}

export interface Endpoint {
  method: string;
  /** In OpenAPI form: `/api/things/{id}`. */
  path: string;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const join = (prefix: string, path: string): string => {
  const joined = `${prefix}/${path}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
};

/** `/:id` and Express 5's `/*fileId` as OpenAPI writes them: `/{id}`, `/{fileId}`. */
const toOpenApiPath = (path: string): string => path.replace(/[:*](\w+)/g, '{$1}');

/** Every method and path the app answers, as OpenAPI would write them. */
export function listRoutes(app: Application): Endpoint[] {
  const router = (app as unknown as { router?: Stacked; _router?: Stacked }).router ?? (app as unknown as { _router: Stacked })._router;
  if (!router) throw new Error('The app has no router yet: build it before listing its routes');
  const found: Endpoint[] = [];

  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const path of paths) {
          for (const method of Object.keys(layer.route.methods).filter((m) => METHODS.includes(m))) {
            found.push({ method, path: toOpenApiPath(join(prefix, path)) });
          }
        }
      } else if (layer.handle?.stack) {
        const mounts = layer.mountPath === undefined ? ['/'] : ([] as string[]).concat(layer.mountPath);
        for (const mount of mounts) walk(layer.handle.stack, join(prefix, mount));
      }
    }
  };
  walk(router.stack, '/');
  return found;
}

const readYaml = (file: string): unknown => parse(fs.readFileSync(file, 'utf8'));

/**
 * Every method and path a spec documents. A path item may live in a file of its
 * own (`$ref: 'paths/thing.yml'`), as file-service's source spec does, so a
 * relative `$ref` is followed.
 */
export function listDocumented(specFile: string): Endpoint[] {
  const spec = readYaml(specFile) as { paths?: Record<string, Record<string, unknown>> };
  return Object.entries(spec.paths ?? {}).flatMap(([path, item]) => {
    const ref = item?.$ref;
    const operations =
      typeof ref === 'string' && !ref.startsWith('#')
        ? (readYaml(nodePath.resolve(nodePath.dirname(specFile), ref)) as Record<string, unknown>)
        : item;
    return Object.keys(operations ?? {})
      .filter((method) => METHODS.includes(method))
      .map((method) => ({ method, path }));
  });
}

/** A route's identity regardless of what its parameters are called: `{id}` and `{conversationId}` match. */
const key = ({ method, path }: Endpoint) => `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, '{}')}`;
const label = ({ method, path }: Endpoint) => `${method.toUpperCase()} ${path}`;

/**
 * Served by backend-core in every service, for the platform rather than for API
 * callers: Kubernetes-style liveness and Prometheus. Not expected in each spec.
 */
export const PLATFORM_ROUTES = ['GET /health/live', 'GET /metrics'];

export interface OpenApiDrift {
  /** Routes the app serves that the spec does not mention. */
  undocumented: string[];
  /** Operations the spec describes that the app does not serve. */
  stale: string[];
}

/**
 * What the spec and the app disagree on. `ignore` takes routes that are
 * deliberately left out of the docs (`'GET /docs'`, or a pattern), on top of
 * the platform routes.
 */
export function openApiDrift(app: Application, specFile: string, ignore: Array<string | RegExp> = []): OpenApiDrift {
  const rules = [...PLATFORM_ROUTES, ...ignore];
  const skipped = (endpoint: Endpoint) =>
    rules.some((rule) => (typeof rule === 'string' ? rule === label(endpoint) : rule.test(label(endpoint))));
  const routes = listRoutes(app).filter((endpoint) => !skipped(endpoint));
  const documented = listDocumented(specFile).filter((endpoint) => !skipped(endpoint));
  const routeKeys = new Set(routes.map(key));
  const documentedKeys = new Set(documented.map(key));
  const unique = (labels: string[]) => [...new Set(labels)].sort();
  return {
    undocumented: unique(routes.filter((endpoint) => !documentedKeys.has(key(endpoint))).map(label)),
    stale: unique(documented.filter((endpoint) => !routeKeys.has(key(endpoint))).map(label))
  };
}
