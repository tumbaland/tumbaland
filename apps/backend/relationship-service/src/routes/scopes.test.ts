import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Every route in this service must state the scope it needs.
 *
 * The scopes were applied across the whole service mechanically, and the failure
 * mode of that is silent: a route that ends up without `requireScope` is not
 * broken for a signed-in person, so nothing looks wrong — it just quietly
 * accepts any API key, whatever it was granted. The same hole opens whenever a
 * new route is added and the guard is forgotten.
 *
 * Read as text rather than by mounting the router, because what matters is the
 * declaration a reviewer sees, and a missing guard is exactly the case where
 * exercising the route would prove nothing.
 */
const ROUTES_DIR = __dirname;

const routeFiles = readdirSync(ROUTES_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts')
);

/** `router.get('/path', ...` — captures the verb and everything up to the handler list. */
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

const READ_VERBS = new Set(['get']);

it('finds routes to check, so a rename cannot make this suite vacuous', () => {
  expect(declarations.length).toBeGreaterThan(20);
});

describe.each(routeFiles)('%s', (file) => {
  it('authenticates the whole router through authenticateAgent', () => {
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    expect(source).toContain('router.use(authenticateAgent())');
    // The JWT-only middleware would refuse every API key, silently undoing the
    // scoping below.
    expect(source).not.toContain('authenticateToken');
  });
});

describe('every route declares a scope', () => {
  it.each(declarations.map((d) => [`${d.file} ${d.verb.toUpperCase()} ${d.path}`, d] as const))(
    '%s',
    (_label, route) => {
      expect(route.rest).toContain('requireScope(');
    }
  );
});

describe('the scope matches what the verb does', () => {
  it.each(declarations.map((d) => [`${d.file} ${d.verb.toUpperCase()} ${d.path}`, d] as const))(
    '%s',
    (_label, route) => {
      const expected = READ_VERBS.has(route.verb)
        ? "requireScope('relationship:read')"
        : "requireScope('relationship:write')";
      expect(route.rest).toContain(expected);
    }
  );
});
