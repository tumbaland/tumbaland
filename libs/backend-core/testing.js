/**
 * Test-only entry point: `@tumbaland/backend-core/testing`.
 *
 * Loading it makes every session token's session count as live, for service
 * test suites that sign tokens without a session and run with no database.
 * Kept out of the package's main exports so production code never reaches it.
 * The session check itself is tested in backend-core (src/auth/session.test.ts).
 */
require('./dist/testing/allowAllSessions');
