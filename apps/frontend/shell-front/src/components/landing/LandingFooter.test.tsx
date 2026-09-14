import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import LandingFooter from './LandingFooter';

const onSignIn = vi.fn();
const onOpen = vi.fn();

const linkTo = (name: RegExp | string) => screen.getByRole('link', { name });

describe('LandingFooter', () => {
  beforeEach(() => {
    onSignIn.mockReset();
    onOpen.mockReset();
    render(<LandingFooter onSignIn={onSignIn} onOpen={onOpen} />);
  });

  it('keeps a real address on each document link, on this site', () => {
    // An old terms link pointed into the billing app and dead-ended. Each link
    // also works opened in a new tab, because the address is real.
    expect(linkTo('Terms')).toHaveAttribute('href', '/terms');
    expect(linkTo('Privacy')).toHaveAttribute('href', '/privacy');
    expect(linkTo('Connect an assistant')).toHaveAttribute('href', '/connect');
  });

  it('opens each document over the page on a plain click', async () => {
    const user = userEvent.setup();

    await user.click(linkTo('Privacy'));
    await user.click(linkTo('Terms'));
    await user.click(linkTo('Connect an assistant'));

    expect(onOpen.mock.calls).toEqual([['privacy'], ['terms'], ['connect']]);
  });

  it('has no link to source code, which is not published', () => {
    expect(screen.queryByRole('link', { name: /source|github/i })).not.toBeInTheDocument();
  });

  it('closes with sign-in and nothing to pay for', async () => {
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/support/i)).not.toBeInTheDocument();
  });
});
