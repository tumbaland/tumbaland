import { render, screen } from '@testing-library/react';

import LandingFooter from './LandingFooter';

/**
 * The footer is the only route a signed-out visitor has to any of the three
 * public documents. Nothing else on the landing page links to them, so a broken
 * or missing link here means the page simply does not exist as far as anyone
 * without an account is concerned.
 */
const linkTo = (name: RegExp | string) => screen.getByRole('link', { name });

describe('LandingFooter', () => {
  beforeEach(() => render(<LandingFooter onSignIn={() => undefined} />));

  it('links to the terms on this site, not into the billing app', () => {
    // The previous link pointed at /payments/terms. Payment-front is served
    // from its own hostname, so that path hit this app's SPA fallback and
    // dead-ended on a page that does not exist.
    expect(linkTo('Terms')).toHaveAttribute('href', '/terms');
  });

  it('links to the privacy policy', () => {
    expect(linkTo('Privacy')).toHaveAttribute('href', '/privacy');
  });

  it('links to the connector guide, which nothing else on the page mentions', () => {
    expect(linkTo('Connect an assistant')).toHaveAttribute('href', '/connect');
  });

  it('keeps the source link pointed off-site, opened safely', () => {
    const source = linkTo('Source');

    expect(source).toHaveAttribute('href', 'https://github.com/toomastahves/tumbaland');
    expect(source).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
