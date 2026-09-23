import { escapeRegex } from './escapeRegex';

describe('escapeRegex', () => {
  it.each([['c++'], [':)'], ['what?'], ['a.b'], ['(a+)+$'], ['[x]'], ['\\']])('matches %s literally', (text) => {
    const pattern = new RegExp(escapeRegex(text));

    expect(pattern.test(`before ${text} after`)).toBe(true);
  });

  it('leaves plain words alone', () => {
    expect(escapeRegex('coffee')).toBe('coffee');
  });
});
