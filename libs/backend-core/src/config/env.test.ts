import { requireEnv } from './env';

describe('requireEnv', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the value when the variable is set', () => {
    process.env.MY_VAR = 'hello';
    expect(requireEnv('MY_VAR')).toBe('hello');
  });

  it('throws when the variable is missing', () => {
    delete process.env.MY_VAR;
    expect(() => requireEnv('MY_VAR')).toThrow('Missing required environment variable: MY_VAR');
  });

  it('throws when the variable is an empty string', () => {
    process.env.MY_VAR = '';
    expect(() => requireEnv('MY_VAR')).toThrow('Missing required environment variable: MY_VAR');
  });
});
