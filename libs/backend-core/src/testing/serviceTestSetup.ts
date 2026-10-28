import { overrideSessionCheckForTests } from '../auth/session';
import { overrideMembershipLookupForTests } from '../groups/membership';
import { recordMountPaths } from './openapi';

/**
 * Jest setup for service test suites: they sign session tokens without a
 * session and run with no database or group-service, so every token's session
 * counts as live and its `groups` claim stands in for group membership.
 * The session check itself is tested in backend-core (auth/session.test.ts).
 *
 * Loaded through the package's test-only entry point:
 *   setupFiles: ['@tumbaland/backend-core/testing']
 */
overrideSessionCheckForTests(async () => true);

// No group-service either: a test token's own `groups` claim is taken as the
// person's membership. The live lookup is tested in groups/membership.test.ts.
overrideMembershipLookupForTests(async (user) => user.groups ?? []);

// Before any app is built, so the OpenAPI drift check can see where routers are mounted.
recordMountPaths();
