import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

const redirectToLogin = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    redirectToLogin: () => redirectToLogin()
  }
}));

// The pricing table reads the catalog from payment-service — the numbers on the
// cards are the numbers the services enforce, so the fixture below stands in
// for `GET /api/plans` rather than for a hardcoded table.
vi.mock('../services/plansService', () => ({ getPlans: vi.fn() }));

import LandingPage from './LandingPage';
import { getPlans } from '../services/plansService';
import { limitLinesFor } from '../config/pricing';
import { PRODUCTS } from '../components/landing/ProductsSection';

const GB = 1024 ** 3;

const CATALOG = [
  {
    code: 'free',
    name: 'Free',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    effectiveLimits: {
      meters: { storageBytes: GB, aiJobs: 25, trackedTickers: 3, seats: 1 },
      features: { cleanExport: false },
      retentionDays: 90
    }
  },
  {
    code: 'personal',
    name: 'Personal',
    priceMonthlyCents: 600,
    priceYearlyCents: 6000,
    effectiveLimits: {
      meters: { storageBytes: 50 * GB, aiJobs: 200, trackedTickers: 25, seats: 1 },
      features: { cleanExport: true },
      retentionDays: -1
    }
  },
  {
    code: 'family',
    name: 'Family',
    priceMonthlyCents: 1200,
    priceYearlyCents: 12000,
    effectiveLimits: {
      meters: { storageBytes: 250 * GB, aiJobs: 600, trackedTickers: 100, seats: 5 },
      features: { cleanExport: true },
      retentionDays: -1
    }
  }
];

const mockedGetPlans = getPlans as ReturnType<typeof vi.fn>;

beforeEach(() => {
  redirectToLogin.mockReset();
  mockedGetPlans.mockReset();
  mockedGetPlans.mockResolvedValue(CATALOG);
});

it('says what the product is in the headline, not just what it feels like', () => {
  render(<LandingPage />);
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent(/photos/i);
  expect(h1).toHaveTextContent(/money/i);
  expect(h1).toHaveTextContent(/one private place/i);
});

it('holds the product visual back until after the pillars are explained', () => {
  render(<LandingPage />);
  const preview = screen.getByTestId('product-preview');
  const pillars = screen.getByRole('heading', { name: /Four things worth tracking/ });
  expect(
    pillars.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

it('leads each pillar with one sentence before its bullets', () => {
  render(<LandingPage />);
  PRODUCTS.forEach((product) => {
    expect(screen.getByText(product.lede)).toBeInTheDocument();
  });
});

it('names each module the same way the app nav does', () => {
  render(<LandingPage />);
  PRODUCTS.forEach((product) => {
    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: product.headline })).toBeInTheDocument();
  });
});

it('answers the privacy objection before asking for money', () => {
  render(<LandingPage />);
  const privacy = screen.getByRole('heading', { name: /Before you hand it anything/ });
  const pricing = screen.getByRole('heading', { name: /Real numbers/ });
  expect(privacy.compareDocumentPosition(pricing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  expect(screen.getByRole('heading', { name: /Private until you share/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /No password to leak/ })).toBeInTheDocument();
});

it('names the three sensitive things once, not twice', () => {
  render(<LandingPage />);
  expect(screen.getAllByText(/balance sheet/i)).toHaveLength(1);
});

it('renders a card for every plan the API returns, with its monthly price', async () => {
  render(<LandingPage />);
  for (const plan of CATALOG) {
    expect(await screen.findByRole('heading', { name: plan.name })).toBeInTheDocument();
  }
  expect(screen.getByText('€6')).toBeInTheDocument();
  expect(screen.getByText('€12')).toBeInTheDocument();
});

it('says pricing is unavailable rather than falling back to numbers of its own', async () => {
  // A hardcoded table is the defect this section was rebuilt to remove: the
  // moment the page can invent a ceiling, the card and the middleware are two
  // different claims again.
  mockedGetPlans.mockRejectedValue(new Error('payment-service down'));
  render(<LandingPage />);

  expect(await screen.findByText(/Pricing is temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('€6')).not.toBeInTheDocument();
});

it('switches every paid price to the yearly figure', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Personal' });

  await user.click(screen.getByRole('button', { name: /Yearly/ }));

  expect(screen.getByText('€60')).toBeInTheDocument();
  expect(screen.getByText('€120')).toBeInTheDocument();
  expect(screen.queryByText('€6')).not.toBeInTheDocument();
});

it('frames the unreleased pricing as free rather than as an unfinished product', () => {
  render(<LandingPage />);
  expect(screen.getByText(/Everything is free right now/)).toBeInTheDocument();
});

it('keeps the cost explanation as scannable questions after the price table', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  const question = screen.getByRole('button', { name: /What happens when I hit a limit/ });
  const pricing = screen.getByRole('heading', { name: /Real numbers/ });
  expect(pricing.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(question);
  expect(await screen.findByText(/Reading your own data is never behind the paywall/)).toBeVisible();
});

it('sends every plan button to sign-in, since there is no account to bill yet', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  await user.click(await screen.findByRole('button', { name: 'Choose Personal' }));
  expect(redirectToLogin).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: 'Start free' }));
  expect(redirectToLogin).toHaveBeenCalledTimes(2);
});

it('sends the hero and footer calls to action to sign-in', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  const ctas = screen.getAllByRole('button', { name: /Start free with Google/ });
  expect(ctas).toHaveLength(2);

  await user.click(ctas[0]);
  await user.click(ctas[1]);
  expect(redirectToLogin).toHaveBeenCalledTimes(2);
});

it('scrolls to pricing rather than navigating away', async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const user = userEvent.setup();
  render(<LandingPage />);

  await user.click(screen.getByRole('button', { name: /See pricing/ }));

  expect(scrollIntoView).toHaveBeenCalled();
  expect(redirectToLogin).not.toHaveBeenCalled();
});

it('lists what each plan includes, and omits rather than dashes what it does not', async () => {
  render(<LandingPage />);

  const personalCard = (await screen.findByRole('heading', { name: 'Personal' })).closest('div.MuiPaper-root');
  limitLinesFor(CATALOG[1].effectiveLimits).forEach((line) => {
    expect(within(personalCard as HTMLElement).getByText(line.text)).toBeInTheDocument();
  });

  // The planner is not on Free, so that card simply has one line fewer.
  const freeCard = screen.getByRole('heading', { name: 'Free' }).closest('div.MuiPaper-root');
  expect(within(freeCard as HTMLElement).queryByText('Portfolio planner')).not.toBeInTheDocument();
  expect(within(freeCard as HTMLElement).queryByText('—')).not.toBeInTheDocument();
  expect(within(freeCard as HTMLElement).getByText('1 GB photos')).toBeInTheDocument();
});

it('quotes the free tier\'s real limits in the FAQ, not a written-out copy of them', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Free' });

  await user.click(screen.getByRole('button', { name: /Do I have to pay anything/ }));

  expect(await screen.findByText(/1 gb photos, 90 days of history, 3 tracked tickers/i)).toBeVisible();
});

it('drops the figures from the FAQ rather than inventing them when the catalog is down', async () => {
  mockedGetPlans.mockRejectedValue(new Error('payment-service down'));
  const user = userEvent.setup();
  render(<LandingPage />);
  await screen.findByText(/Pricing is temporarily unavailable/);

  await user.click(screen.getByRole('button', { name: /Do I have to pay anything/ }));

  const answer = await screen.findByText(/no expiry and no card/i);
  expect(answer).toBeVisible();
  expect(answer.textContent).not.toMatch(/\d/);
});

it('advertises no AI or watermark line, because nothing enforces either', async () => {
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Family' });

  expect(screen.queryByText(/AI (photo )?scans?/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/watermarked/i)).not.toBeInTheDocument();
});
