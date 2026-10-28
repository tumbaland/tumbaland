import { initials } from './initials';

it('takes the first letter of the first two words, upper-cased', () => {
  expect(initials('ada lovelace')).toBe('AL');
  expect(initials('Jean Claude Van Damme')).toBe('JC');
});

it('copes with extra whitespace and a single word', () => {
  expect(initials('  Ada   Lovelace  ')).toBe('AL');
  expect(initials('Ada')).toBe('A');
});

it('falls back to a question mark when there is no name', () => {
  expect(initials('')).toBe('?');
  expect(initials('   ')).toBe('?');
});
