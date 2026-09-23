import { render } from '@testing-library/react';
import { Box } from '@mui/material';
import { DARK } from './tokens';

describe('DARK', () => {
  afterEach(() => document.documentElement.removeAttribute('data-color-scheme'));

  // jsdom resolves the cascade for selectors, not custom properties, so the
  // check is that the dark rule's selector matches the element at all.
  const darkRuleMatches = (element: Element): boolean =>
    [...document.querySelectorAll('style')]
      .flatMap((style) => [...(style.sheet?.cssRules ?? [])])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText.includes('dark'))
      .some((rule) => element.matches(rule.selectorText));

  it('reaches the element under the dark scheme', () => {
    document.documentElement.setAttribute('data-color-scheme', 'dark');
    const { getByTestId } = render(<Box data-testid="box" sx={{ color: 'red', [DARK]: { color: 'blue' } }} />);

    expect(darkRuleMatches(getByTestId('box'))).toBe(true);
  });

  it('stays off under the light scheme', () => {
    document.documentElement.setAttribute('data-color-scheme', 'light');
    const { getByTestId } = render(<Box data-testid="box" sx={{ color: 'red', [DARK]: { color: 'blue' } }} />);

    expect(darkRuleMatches(getByTestId('box'))).toBe(false);
  });
});
