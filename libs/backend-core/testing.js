/**
 * Test-only entry point: `@tumbaland/backend-core/testing`.
 *
 * Loading it makes every session token's session count as live, and a test
 * token's `groups` claim its group membership, for service test suites that
 * run with no database and no group-service.
 * Kept out of the package's main exports so production code never reaches it.
 * The session check itself is tested in backend-core (src/auth/session.test.ts).
 */
require('./dist/testing/serviceTestSetup');
