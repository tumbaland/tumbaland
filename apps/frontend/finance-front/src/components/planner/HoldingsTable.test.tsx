import { render, screen } from '@testing-library/react';
import HoldingsTable, { HoldingStat } from './HoldingsTable';

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => setMobile(false));

const holdings: HoldingStat[] = [
  {
    _id: 'h1',
    ticker: 'AAPL',
    quantity: 10,
    avgBuyPrice: 100,
    latestPrice: 150,
    currentValue: 1500,
    returnPct: 50
  },
  {
    _id: 'h2',
    ticker: 'BND',
    quantity: 5,
    avgBuyPrice: 80,
    latestPrice: null,
    currentValue: null,
    returnPct: null
  }
];

it('renders a desktop table with names, prices, returns, and weights', () => {
  render(<HoldingsTable holdings={holdings} nameByTicker={{ AAPL: 'Apple' }} totalValue={1500} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('+50.00%')).toBeInTheDocument();
  expect(screen.getByText('100.0%')).toBeInTheDocument();
  // BND has no name mapping, price, value, or return — all dashed.
  const dashes = screen.getAllByText('—');
  expect(dashes.length).toBeGreaterThan(0);
});

it('renders stacked cards in the mobile layout with the same figures', () => {
  setMobile(true);
  render(<HoldingsTable holdings={holdings} nameByTicker={{ AAPL: 'Apple' }} totalValue={1500} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('+50.00%')).toBeInTheDocument();
  expect(screen.getByText('100.0%')).toBeInTheDocument();
});

it('omits weight when totalValue is zero', () => {
  render(<HoldingsTable holdings={holdings} nameByTicker={{}} totalValue={0} />);

  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});
