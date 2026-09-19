import { overrideSessionCheckForTests } from '../auth/session';

/**
 * Jest setup for service test suites: they sign session tokens without a
 * session and run with no database, so every token's session counts as live.
 * The session check itself is tested in backend-core (auth/session.test.ts).
 *
 * Loaded through the package's test-only entry point:
 *   setupFiles: ['@tumbaland/backend-core/testing']
 */
overrideSessionCheckForTests(async () => true);
