// The package root pulls in a dependency that ships ESM Jest will not load;
// nothing from it is exercised here (see relationship.test.ts).
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { dateSchema } from './module';

describe('dateSchema', () => {
  it('accepts a real day, leap days included', () => {
    expect(dateSchema.safeParse('2026-09-23').success).toBe(true);
    expect(dateSchema.safeParse('2024-02-29').success).toBe(true);
  });

  it.each([['2026-02-31'], ['2025-02-29'], ['2026-13-01'], ['2026-04-31']])(
    'refuses %s, which matches the pattern but is not a day',
    (day) => {
      const result = dateSchema.safeParse(day);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('That day does not exist');
    }
  );

  it('still explains the format when that is what is wrong', () => {
    expect(dateSchema.safeParse('23.09.2026').error?.issues[0]?.message).toBe('Use YYYY-MM-DD');
  });
});
