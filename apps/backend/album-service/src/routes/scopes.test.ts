import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Every authenticated route in this service must state the scope it needs.
 *
 * The guards were applied across the service mechanically, and a route that
 * ends up without `requireScope` fails silently: nothing breaks for a signed-in
 * person, it just accepts any API key regardless of what that key was granted.
 * The same hole opens the first time someone adds a route and forgets.
 *
 * Read as text rather than by mounting the router, because what matters is the
 * declaration a reviewer sees, and a missing guard is exactly the case where
 * exercising the route would prove nothing.
 */
const ROUTES_DIR = __dirname;

/**
 * Routes that are deliberately unauthenticated.
 *
 * `/by-file/:fileId` is called by file-service, which holds no user session.
 * Listed explicitly so removing a route's auth is a visible edit to this file
 * rather than a silent gap in the suite.
 */
const PUBLIC_ROUTES = new Set(['get /by-file/:fileId']);

const routeFiles = readdirSync(ROUTES_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts')
);

const ROUTE_PATTERN = /router\.(get|post|put|patch|delete)\(\s*'([^']*)'([^;]*)/g;

interface RouteDeclaration {
  file: string;
  verb: string;
  path: string;
  rest: string;
}

const declarations: RouteDeclaration[] = routeFiles.flatMap((file) => {
  const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
  return [...source.matchAll(ROUTE_PATTERN)].map((match) => ({
    file,
    verb: match[1],
    path: match[2],
    rest: match[3]
  }));
});

const guarded = declarations.filter((d) => !PUBLIC_ROUTES.has(`${d.verb} ${d.path}`));
const READ_VERBS = new Set(['get']);

it('finds routes to check, so a rename cannot make this suite vacuous', () => {
  expect(guarded.length).toBeGreaterThan(15);
});

it('no longer reaches for the JWT-only middleware, which would refuse every key', () => {
  for (const file of routeFiles) {
    expect(readFileSync(join(ROUTES_DIR, file), 'utf8')).not.toContain('authenticateToken');
  }
});

it('leaves the file-service route public, since it carries no user session', () => {
  const source = readFileSync(join(ROUTES_DIR, 'photoRoutes.ts'), 'utf8');
  const publicRoute = source
    .split('\n')
    .find((line) => line.includes("'/by-file/:fileId'"));

  expect(publicRoute).toBeDefined();
  expect(publicRoute).not.toContain('authenticateAgent');
  expect(publicRoute).not.toContain('requireScope');
});

describe('every authenticated route declares a scope', () => {
  it.each(guarded.map((d) => [`${d.file} ${d.verb.toUpperCase()} ${d.path}`, d] as const))(
    '%s',
    (_label, route) => {
      expect(route.rest).toContain('requireScope(');
    }
  );
});

describe('the scope matches what the verb does', () => {
  it.each(guarded.map((d) => [`${d.file} ${d.verb.toUpperCase()} ${d.path}`, d] as const))(
    '%s',
    (_label, route) => {
      const expected = READ_VERBS.has(route.verb)
        ? "requireScope('album:read')"
        : "requireScope('album:write')";
      expect(route.rest).toContain(expected);
    }
  );
});
