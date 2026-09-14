import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

const redirectToLogin = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    redirectToLogin: () => redirectToLogin()
  }
}));

import LandingPage from './LandingPage';
import { PRODUCTS } from '../components/landing/ProductsSection';

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

it('leads with the assistant, which is the part nothing else on the shelf has', () => {
  renderPage();
  const h1 = screen.getByRole('heading', { level: 1 });

  expect(h1).toHaveTextContent(/tell your assistant/i);
  // "your money" reads as though we hold it. We track it; we never touch it.
  expect(h1).not.toHaveTextContent(/your money/i);
});

it('claims only the client that has been tested, above the fold', () => {
  renderPage();
  expect(screen.getByText(/Works with Claude . and any MCP client/)).toBeInTheDocument();
  expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
});

it('shows the connector address, which is the one thing nobody can guess', () => {
  renderPage();
  expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
});

it('explains connecting before listing the modules', () => {
  renderPage();
  const connect = screen.getByRole('heading', { name: /One address, and it is connected/ });
  const modules = screen.getByRole('heading', { name: /Four things, one login/ });

  // The hero makes a claim that only holds if connecting is this small a job.
  expect(connect.compareDocumentPosition(modules) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('names each module the way the app nav does, with one sentence on what is in it', () => {
  renderPage();
  PRODUCTS.forEach((product) => {
    expect(screen.getAllByText(product.name).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: product.headline })).toBeInTheDocument();
    expect(screen.getByText(product.lede)).toBeInTheDocument();
  });
});

it('answers the privacy objection before the closing sign-in', () => {
  renderPage();
  const privacy = screen.getByRole('heading', { name: /Before you hand it anything/ });
  const closing = screen.getByRole('heading', { name: /It's free/ });
  expect(privacy.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  expect(screen.getByRole('heading', { name: /Private until you share/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /No password to leak/ })).toBeInTheDocument();
});

it('names the three sensitive things once, not twice', () => {
  renderPage();
  expect(screen.getAllByText(/balance sheet/i)).toHaveLength(1);
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

it('scrolls to the setup rather than navigating away', async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole('button', { name: /See how it connects/ }));

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
