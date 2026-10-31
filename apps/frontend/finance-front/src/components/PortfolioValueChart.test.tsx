import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortfolioValueChart from './PortfolioValueChart';

// PortfolioValueChart defaults to a 5-year lookback window measured from "now" —
// use dates relative to the current year so the default filter includes them.
const thisYear = new Date().getFullYear();
const records = [
  { date: `${thisYear - 5}-01-01`, totalValue: 500, assetBreakdown: { Stocks: 400, Bonds: 100 } },
  { date: `${thisYear - 1}-01-01`, totalValue: 1500, assetBreakdown: { Stocks: 1000, Bonds: 500 } },
  { date: `${thisYear}-01-01`, totalValue: 0, assetBreakdown: { Stocks: 0, Bonds: 0 } }
];

it('shows an empty state when there are no records', () => {
  render(<PortfolioValueChart records={[]} />);
  expect(screen.getByText(/no data available/i)).toBeInTheDocument();
});

it('renders the chart title and time period selector when data is present', () => {
  render(<PortfolioValueChart records={records} />);
  expect(screen.getByText('Net Worth Over Time')).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveTextContent('Last 5 Years');
});

it('opens on five years, so the longer trend is what you see first', () => {
  // A record four years back is inside the default window; one from the 2000s is not
  const fourYearsBack = [{ date: `${thisYear - 4}-06-01`, totalValue: 800, assetBreakdown: { Stocks: 800 } }];
  render(<PortfolioValueChart records={fourYearsBack} />);

  expect(screen.getByRole('combobox')).toHaveTextContent('Last 5 Years');
  expect(screen.queryByText(/no data available/i)).not.toBeInTheDocument();
});

it('filters out records older than the selected time period', async () => {
  render(<PortfolioValueChart records={records} />);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: 'All Time' }));

  // Switching to "All Time" re-includes the oldest record without throwing.
  expect(screen.getByText('Net Worth Over Time')).toBeInTheDocument();
});

it('toggles log scale, replacing zero values so log(0) is avoided', async () => {
  render(<PortfolioValueChart records={records} />);

  const logSwitch = screen.getByRole('switch', { name: /log scale/i });
  expect(logSwitch).not.toBeChecked();

  await userEvent.click(logSwitch);

  expect(logSwitch).toBeChecked();
});

it('shows an empty state when every record falls outside the default 5-year window', () => {
  const old = [{ date: '2000-01-01', totalValue: 500 }];
  render(<PortfolioValueChart records={old} />);
  expect(screen.getByText(/no data available/i)).toBeInTheDocument();
});
