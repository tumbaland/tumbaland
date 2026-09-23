import { hasNestedRepetition } from './nestedRepetition';

describe('hasNestedRepetition', () => {
  it.each([
    ['(a+)+$'],
    ['(a*)*'],
    ['(\\d+\\s?)+'],
    ['(.*a){20}'],
    ['(x+){10,}'],
    ['(?:[a-z]+,?)*$'],
    ['((ab)+c)+'],
    ['(a+?)+'],
    ['((a+))+']
  ])('flags %s', (pattern) => {
    expect(hasNestedRepetition(pattern)).toBe(true);
  });

  it.each([
    ['\\bBOLT\\b(?! ?Food)'],
    ['^RIMI'],
    ['SELVER|RIMI|PRISMA'],
    ['(a+){2}'],
    ['(ab)+'],
    ['a+b+c*'],
    ['\\(a+\\)+'],
    ['[(]a+[)]+'],
    ['[a\\]+]+'],
    ['(?<name>x)\\k<name>'],
    ['x{1,100000}']
  ])('passes %s', (pattern) => {
    expect(hasNestedRepetition(pattern)).toBe(false);
  });
});
