import path from 'path';
import { openApiDrift } from '@tumbaland/backend-core/testing';
import app from './app';

/**
 * openapi/openapi.yml (bundled into docs/ at build) is written by hand, because it explains the API as well as
 * listing it. This keeps it complete: a new route fails here until it is
 * documented, and a removed one until its entry goes too.
 */
it('documents every route the service serves, and nothing it does not', () => {
  expect(openApiDrift(app, path.join(__dirname, '../openapi/openapi.yml'))).toEqual({ undocumented: [], stale: [] });
});
