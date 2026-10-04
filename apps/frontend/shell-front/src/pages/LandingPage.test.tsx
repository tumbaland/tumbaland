import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, expect, it, vi } from 'vite-plus/test';

const redirectToLogin = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    redirectToLogin: () => redirectToLogin()
  }
}));

import LandingPage from './LandingPage';

function CurrentUrl() {
  const location = useLocation();
  return <div data-testid="url">{`${location.pathname}${location.search}`}</div>;
}

/** The page keeps the open document in the URL, so it needs a router. */
const renderPage = (entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LandingPage />
      <CurrentUrl />
    </MemoryRouter>
  );

beforeEach(() => {
  redirectToLogin.mockReset();
});

it('leads with what the app is for, a place for the two of you', () => {
  renderPage();
  const h1 = screen.getByRole('heading', { level: 1 });

  expect(h1).toHaveTextContent(/private app for the two of you/i);
  // "your money" reads as though we hold it. We track it; we never touch it.
  expect(h1).not.toHaveTextContent(/your money/i);
});

it('names only the client that has been tested', () => {
  renderPage();
  expect(screen.getByText('Works with Claude')).toBeInTheDocument();
  expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
});

it('shows the connector address, which is the one thing nobody can guess', () => {
  renderPage();
  expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
});

it('shows the app before the assistant, which is an extra', () => {
  renderPage();
  const modules = screen.getByRole('heading', { name: /Your photos and your journal/ });
  const assistant = screen.getByRole('heading', { name: /Use it from Claude/ });

  expect(modules.compareDocumentPosition(assistant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('shows the app as screens rather than paragraphs about it', () => {
  renderPage();

  // Chat in the hero, the album and journal under it, each named the way the
  // app nav names it, with one short line and no more.
  ['Journal', 'Chat', 'Album'].forEach((module) => {
    expect(screen.getAllByText(module).length).toBeGreaterThan(0);
  });
  expect(screen.getByText('What you did and where')).toBeInTheDocument();
  expect(screen.getByText('Photos from this day in past years')).toBeInTheDocument();
});

it('keeps to the fundamentals, with no settings on show', () => {
  renderPage();
  expect(screen.queryByText(/dark mode|light mode|chat theme/i)).not.toBeInTheDocument();
});

it("says the screens are made up, rather than passing them off as somebody's", () => {
  // They are the app's own layout, but the evenings, the messages and the
  // holiday in them are invented, and a page that shows data owes that line.
  renderPage();
  expect(screen.getByText(/made-up data/i)).toBeInTheDocument();
});

it('still says sharing exists, now that the fourth card has gone', () => {
  renderPage();
  expect(screen.getByText(/add other people to your group/)).toBeInTheDocument();
});

it('answers the privacy objection before the closing sign-in', () => {
  renderPage();
  const privacy = screen.getByRole('heading', { name: /How your data is kept/ });
  const closing = screen.getByRole('heading', { name: /Tumbaland is free/ });
  expect(privacy.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  expect(screen.getByRole('heading', { name: /Only your group/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Google sign-in/ })).toBeInTheDocument();
});

it('names the three sensitive things once, not twice', () => {
  renderPage();
  expect(screen.getAllByText(/your photos, messages and journal/i)).toHaveLength(1);
});

it('has nothing to buy: no prices, plans or supporter pitch', () => {
  // Tumbaland is free. A price table, a yearly toggle or a "why support" answer
  // on the front page would be selling something that is not for sale.
  renderPage();

  expect(screen.queryByText(/€\s?\d|\d\s?€/)).not.toBeInTheDocument();
  expect(screen.queryByText(/supporter|pricing|per month|\bplans?\b/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Support/ })).not.toBeInTheDocument();
});

it('does not claim to be open source', () => {
  renderPage();
  expect(screen.queryByText(/open source|github/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
});

it('sends every sign-in button to Google sign-in', async () => {
  const user = userEvent.setup();
  renderPage();

  const continues = screen.getAllByRole('button', { name: /Continue with Google/ });
  expect(continues).toHaveLength(2);
  for (const button of continues) {
    await user.click(button);
  }
  // The bar's own, for a reader who has scrolled past the hero.
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(redirectToLogin).toHaveBeenCalledTimes(3);
});

it('scrolls to the screens of the app rather than navigating away', async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole('button', { name: /See how it looks/ }));

  expect(scrollIntoView).toHaveBeenCalled();
  expect(redirectToLogin).not.toHaveBeenCalled();
});

it('keeps each document link a real address, so it still opens in a new tab', () => {
  renderPage();

  expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  screen.getAllByRole('link', { name: 'Terms' }).forEach((link) => expect(link).toHaveAttribute('href', '/terms'));
  expect(screen.getByRole('link', { name: 'Connect an assistant' })).toHaveAttribute('href', '/connect');
  expect(screen.getByRole('link', { name: /Full setup guide/ })).toHaveAttribute('href', '/connect');
});

it('opens the privacy policy over the page, and closing returns to it', async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole('link', { name: 'Privacy policy' }));

  const dialog = await screen.findByRole('dialog', { name: 'Privacy' });
  expect(within(dialog).getByText(/What Tumbaland stores/)).toBeInTheDocument();
  // In the URL, so a phone's back button closes it and the link can be shared.
  expect(screen.getByTestId('url')).toHaveTextContent('/?read=privacy');

  await user.click(within(dialog).getByRole('button', { name: 'Close' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/$/);
});

it('opens the terms from the footer and the setup guide from the connect section', async () => {
  const user = userEvent.setup();
  renderPage();

  const footer = screen.getByRole('contentinfo');
  await user.click(within(footer).getByRole('link', { name: 'Terms' }));
  const terms = await screen.findByRole('dialog', { name: 'Terms' });
  await user.click(within(terms).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await user.click(screen.getByRole('link', { name: /Full setup guide/ }));
  const guide = await screen.findByRole('dialog', { name: 'Connect an assistant' });
  expect(within(guide).getAllByText(/mcp\.tumbaland\.eu\/mcp/).length).toBeGreaterThan(0);
});

it('opens straight onto a document from a shared link, and closing stays on the page', async () => {
  const user = userEvent.setup();
  renderPage('/?read=terms');

  const dialog = await screen.findByRole('dialog', { name: 'Terms' });
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByTestId('url')).toHaveTextContent(/^\/$/);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
});

it('ignores a document name it does not know', () => {
  renderPage('/?read=pricing');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
