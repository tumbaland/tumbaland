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
    code: 'support',
    name: 'Support',
    priceMonthlyCents: 500,
    priceYearlyCents: 5000,
    effectiveLimits: {
      meters: { storageBytes: 50 * GB, aiJobs: 600, trackedTickers: 100, seats: 5 },
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

it('leads with the assistant, which is the part nothing else on the shelf has', () => {
  render(<LandingPage />);
  const h1 = screen.getByRole('heading', { level: 1 });

  // The page used to open by naming the four modules, which puts Tumbaland
  // beside four products it cannot out-feature. The connector is the argument.
  expect(h1).toHaveTextContent(/tell your assistant/i);

  // "your money" reads as though we hold it. We track it; we never touch it.
  expect(h1).not.toHaveTextContent(/your money/i);
});

it('claims only the client that has been tested, above the fold', () => {
  render(<LandingPage />);
  expect(screen.getByText(/Works with Claude . and any MCP client/)).toBeInTheDocument();

  // Naming a product nobody has run it against is a promise the page cannot
  // keep, and the first thing a visitor discovers is whether it was true.
  expect(screen.queryByText(/ChatGPT|Gemini/)).not.toBeInTheDocument();
});

it('shows the connector address, which is the one thing nobody can guess', () => {
  render(<LandingPage />);
  // Concrete enough to act on, and it says plainly that this is an ordinary MCP
  // endpoint rather than something proprietary.
  expect(screen.getByText('https://mcp.tumbaland.eu/mcp')).toBeInTheDocument();
});

it('explains connecting before listing the modules', () => {
  render(<LandingPage />);
  const connect = screen.getByRole('heading', { name: /One address, and it is connected/ });
  const pillars = screen.getByRole('heading', { name: /Four things worth tracking/ });

  // The hero makes a claim that only holds if connecting is this small a job.
  expect(connect.compareDocumentPosition(pillars) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    // Some names now appear twice: once on the capability card above and once
    // on the module card. That repetition is the point — it is the same thing
    // named the same way in both places.
    expect(screen.getAllByText(product.name).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: product.headline })).toBeInTheDocument();
  });
});

it('answers the privacy objection before asking for money', () => {
  render(<LandingPage />);
  const privacy = screen.getByRole('heading', { name: /Before you hand it anything/ });
  const support = screen.getByRole('heading', { name: /The site is free/ });
  expect(privacy.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

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
  expect(screen.getByText('€5')).toBeInTheDocument();
});

it('says pricing is unavailable rather than falling back to numbers of its own', async () => {
  // A hardcoded table is the defect this section was rebuilt to remove: the
  // moment the page can invent a ceiling, the card and the middleware are two
  // different claims again.
  mockedGetPlans.mockRejectedValue(new Error('payment-service down'));
  render(<LandingPage />);

  expect(await screen.findByText(/Plan details are temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('€5')).not.toBeInTheDocument();
});

it('switches every paid price to the yearly figure', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Support' });

  await user.click(screen.getByRole('button', { name: /Yearly/ }));

  expect(screen.getByText('€50')).toBeInTheDocument();
  expect(screen.queryByText('€5')).not.toBeInTheDocument();
});

it('frames the unreleased pricing as free rather than as an unfinished product', () => {
  render(<LandingPage />);
  expect(screen.getByText(/Supporting isn't open yet/)).toBeInTheDocument();
});

it('explains why limits exist before it asks anyone to support', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  // The support cards sit below the FAQ: a visitor meets the ask having
  // already been told they do not have to answer it.
  const question = screen.getByRole('button', { name: /What happens when I hit a limit/ });
  const support = screen.getByRole('heading', { name: /The site is free/ });
  expect(question.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(question);
  expect(await screen.findByText(/Reading your own data is never behind a payment/)).toBeVisible();
});

it('keeps the FAQ to the questions a stranger actually has', async () => {
  // It grew a question per objection until it read as a page-long defence of
  // charging money, under a product that does not charge.
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Support' });

  expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(5);
  expect(screen.getByRole('button', { name: /Do I have to pay anything/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Why would I support/ })).toBeInTheDocument();
});

it('pitches the paid tier as support rather than as the real product', async () => {
  render(<LandingPage />);

  // The badge is on free. On the paid card it read as "the free column is
  // the sample", which is the opposite of what this page says.
  const freeCard = (await screen.findByRole('heading', { name: 'Free' })).closest('div.MuiPaper-root');
  expect(within(freeCard as HTMLElement).getByText('Where everyone starts')).toBeInTheDocument();

  const supportCard = screen.getByRole('heading', { name: 'Support' }).closest('div.MuiPaper-root');
  expect(within(supportCard as HTMLElement).queryByText(/Most people/)).not.toBeInTheDocument();
  expect(within(supportCard as HTMLElement).getByRole('button', { name: 'Become a supporter' })).toBeInTheDocument();
});

it('lists only enforced limits on a card, and nothing else', async () => {
  // Both cards carry the limit lines and nothing more — an extra line on one
  // card is what left the two visibly mismatched in height.
  render(<LandingPage />);
  const supportCard = (await screen.findByRole('heading', { name: 'Support' })).closest('div.MuiPaper-root');

  const lines = limitLinesFor(CATALOG[1].effectiveLimits);
  const checks = within(supportCard as HTMLElement).getAllByTestId('CheckIcon');
  expect(checks).toHaveLength(lines.length);
});

it('offers one paid tier, not a lineup of editions', async () => {
  // Two paid columns ask a visitor which edition they are entitled to. One
  // tier that grants everything leaves only the question actually being asked.
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Support' });

  const priced = CATALOG.filter((plan) => plan.priceMonthlyCents > 0);
  expect(priced).toHaveLength(1);
  expect(screen.queryByRole('heading', { name: 'Personal' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Family' })).not.toBeInTheDocument();
});

it('sends every plan button to sign-in, since there is no account to bill yet', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  await user.click(await screen.findByRole('button', { name: 'Become a supporter' }));
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

it('scrolls to the setup rather than navigating away', async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const user = userEvent.setup();
  render(<LandingPage />);

  await user.click(screen.getByRole('button', { name: /See how it connects/ }));

  expect(scrollIntoView).toHaveBeenCalled();
  expect(redirectToLogin).not.toHaveBeenCalled();
});

it('offers a way back to sign-in after the hero has scrolled past', async () => {
  const user = userEvent.setup();
  render(<LandingPage />);

  // The page had one sign-in button, in the hero, and nothing in the nav — so a
  // returning visitor who scrolled had no way back to it.
  await user.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);

  expect(redirectToLogin).toHaveBeenCalledTimes(1);
});

it('lists what each plan includes, and omits rather than dashes what it does not', async () => {
  render(<LandingPage />);

  const supportCard = (await screen.findByRole('heading', { name: 'Support' })).closest('div.MuiPaper-root');
  limitLinesFor(CATALOG[1].effectiveLimits).forEach((line) => {
    expect(within(supportCard as HTMLElement).getByText(line.text)).toBeInTheDocument();
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
  await screen.findByText(/Plan details are temporarily unavailable/);

  await user.click(screen.getByRole('button', { name: /Do I have to pay anything/ }));

  const answer = await screen.findByText(/no card and no expiry/i);
  expect(answer).toBeVisible();
  expect(answer.textContent).not.toMatch(/\d/);
});

it('advertises no AI or watermark line, because nothing enforces either', async () => {
  render(<LandingPage />);
  await screen.findByRole('heading', { name: 'Support' });

  expect(screen.queryByText(/AI (photo )?scans?/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/watermarked/i)).not.toBeInTheDocument();
});
