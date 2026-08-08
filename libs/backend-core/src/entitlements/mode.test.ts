jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { getEntitlementsMode, resetEntitlementsModeWarning } from './mode';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ENTITLEMENTS_MODE;
  resetEntitlementsModeWarning();
  (logger.warn as jest.Mock).mockClear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getEntitlementsMode', () => {
  it('defaults to observe when unset', () => {
    expect(getEntitlementsMode()).toBe('observe');
  });

  it('reads each valid mode, case- and whitespace-insensitively', () => {
    process.env.ENTITLEMENTS_MODE = 'enforce';
    expect(getEntitlementsMode()).toBe('enforce');

    process.env.ENTITLEMENTS_MODE = ' Off ';
    expect(getEntitlementsMode()).toBe('off');
  });

  it('falls back to observe and warns once on an invalid value', () => {
    process.env.ENTITLEMENTS_MODE = 'enforcce';

    expect(getEntitlementsMode()).toBe('observe');
    expect(getEntitlementsMode()).toBe('observe');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('picks up a change without a restart of the module', () => {
    process.env.ENTITLEMENTS_MODE = 'observe';
    expect(getEntitlementsMode()).toBe('observe');

    process.env.ENTITLEMENTS_MODE = 'enforce';
    expect(getEntitlementsMode()).toBe('enforce');
  });
});
