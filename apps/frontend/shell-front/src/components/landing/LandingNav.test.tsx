import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

import LandingNav from './LandingNav';

const renderNav = (onSignIn = vi.fn()) => {
  render(<LandingNav onSignIn={onSignIn} />);
  return onSignIn;
};

describe('LandingNav', () => {
  it('signs in from the bar, wherever the reader has scrolled to', async () => {
    const user = userEvent.setup();
    const onSignIn = renderNav();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('carries the name home, and no menu to open first', () => {
    // The phone menu held four section links and hid sign-in behind a tap. The
    // page is short enough now that a flick reaches every section.
    renderNav();

    expect(screen.getByRole('link', { name: 'Tumbaland' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pricing' })).not.toBeInTheDocument();
  });

  it('takes on a surface once the page moves under it', async () => {
    // Driven by an observer on a marker at the top of the page, not by a scroll
    // listener: the landing page scrolls inside the shell Layout's container,
    // so `window.scrollY` stays at zero however far down you are and a scroll
    // listener never fires. Left that way, the bar stayed transparent over the
    // scrolled content and the two overlapped into something unreadable.
    let notify: ((records: Array<{ isIntersecting: boolean }>) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (records: Array<{ isIntersecting: boolean }>) => void) {
          notify = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );

    renderNav();
    const bar = screen.getByRole('navigation', { name: 'Site' });
    expect(bar).toHaveStyle({ background: 'transparent' });

    // The top of the page has left the viewport.
    notify!([{ isIntersecting: false }]);

    await waitFor(() => expect(bar).not.toHaveStyle({ background: 'transparent' }));

    notify!([{ isIntersecting: true }]);
    await waitFor(() => expect(bar).toHaveStyle({ background: 'transparent' }));

    vi.unstubAllGlobals();
  });
});
