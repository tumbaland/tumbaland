import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import LandingNav from './LandingNav';

/**
 * The landing page had no navigation at all: the only way to any section was to
 * scroll past everything above it, and the only sign-in button was the one in
 * the hero — so a returning visitor who scrolled had no way back to it.
 */
const renderNav = (onSignIn = vi.fn()) => {
  render(<LandingNav onSignIn={onSignIn} />);
  return onSignIn;
};

/** A stand-in for the section a nav item points at. */
function plantSection(id: string) {
  const section = document.createElement('section');
  section.id = id;
  document.body.appendChild(section);
  return section;
}

describe('LandingNav', () => {
  it('offers the four questions a visitor actually arrives with', () => {
    renderNav();
    ['Assistant', 'What is in it', 'Privacy', 'Pricing'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('scrolls to a section rather than navigating to it', async () => {
    const user = userEvent.setup();
    const section = plantSection('assistant');
    section.scrollIntoView = vi.fn();
    renderNav();

    await user.click(screen.getByRole('button', { name: 'Assistant' }));

    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('does not throw when the section is not on the page', async () => {
    // The nav is rendered by the landing page, but a section could be removed
    // or renamed, and a nav that throws takes the whole page down with it.
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole('button', { name: 'Privacy' }));

    expect(screen.getByRole('button', { name: 'Privacy' })).toBeInTheDocument();
  });

  it('signs in from the bar, wherever the reader has scrolled to', async () => {
    const user = userEvent.setup();
    const onSignIn = renderNav();

    await user.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('opens a drawer on small screens, offering the same items and the same sign-in', async () => {
    const user = userEvent.setup();
    const onSignIn = renderNav();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    // The drawer is a modal, so the bar behind it leaves the accessibility
    // tree: every button reachable now is one of the drawer's own. That is the
    // behaviour worth pinning — a menu that leaves the page behind it reachable
    // is a menu a screen reader can walk straight out of.
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    ['Assistant', 'What is in it', 'Privacy', 'Pricing'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('closes the drawer once a section is chosen', async () => {
    const user = userEvent.setup();
    const section = plantSection('privacy');
    section.scrollIntoView = vi.fn();
    renderNav();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    await user.click(screen.getByRole('button', { name: 'Privacy' }));

    // Left open, the drawer covers the section it just scrolled to.
    expect(section.scrollIntoView).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
    );
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
    const bar = screen.getByRole('navigation', { name: 'Page sections' });
    expect(bar).toHaveStyle({ background: 'transparent' });

    // The top of the page has left the viewport.
    notify!([{ isIntersecting: false }]);

    await waitFor(() => expect(bar).not.toHaveStyle({ background: 'transparent' }));

    notify!([{ isIntersecting: true }]);
    await waitFor(() => expect(bar).toHaveStyle({ background: 'transparent' }));

    vi.unstubAllGlobals();
  });
});
