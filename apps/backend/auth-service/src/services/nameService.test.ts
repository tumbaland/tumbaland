import { effectiveName } from './nameService';

describe('effectiveName', () => {
  it('prefers the name set on the account page over Google’s', () => {
    expect(effectiveName({ firstName: 'Toomas', lastName: 'Tahves', googleName: 'Tom T' })).toBe('Toomas Tahves');
  });

  it('uses a first name alone when that is all they set', () => {
    expect(effectiveName({ firstName: 'Toomas', lastName: null, googleName: 'Tom T' })).toBe('Toomas');
  });

  it('falls back to Google’s name while they have not set one', () => {
    expect(effectiveName({ firstName: '  ', googleName: 'Tom T' })).toBe('Tom T');
  });

  it('is undefined with no name anywhere, so the caller keeps the token’s', () => {
    expect(effectiveName({})).toBeUndefined();
  });
});
