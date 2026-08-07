import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetWorthMovement from './NetWorthMovement';
import { GrowthBreakdown } from '../../services/cashflowService';

const trailing: GrowthBreakdown = {
  from: '2025-08',
  to: '2026-08',
  months: 12,
  netWorthChange: 24_000,
  contributions: 18_000,
  marketGrowth: 6000,
  complete: true
};

const monthly: GrowthBreakdown = {
  from: '2026-07',
  to: '2026-08',
  months: 1,
  netWorthChange: 2000,
  contributions: 1500,
  marketGrowth: 500,
  complete: true
};

const renderMovement = (over: Partial<React.ComponentProps<typeof NetWorthMovement>> = {}) =>
  render(<NetWorthMovement trailing={trailing} monthly={monthly} {...over} />);

describe('scope', () => {
  it('opens on the trailing year, the scope the rest of the page is on', () => {
    renderMovement();

    expect(screen.getByText('Aug 2025 → Aug 2026 · 12 months')).toBeInTheDocument();
    expect(screen.getByText('+24 000 €')).toBeInTheDocument();
  });

  it('switches to the single-month bridge on request', async () => {
    renderMovement();

    await userEvent.click(screen.getByRole('button', { name: 'Monthly bridge' }));

    expect(screen.getByText('Jul 2026 → Aug 2026 · 1 month')).toBeInTheDocument();
    expect(screen.getByText('+2000 €')).toBeInTheDocument();
  });

  it('switches back to the year', async () => {
    renderMovement();

    await userEvent.click(screen.getByRole('button', { name: 'Monthly bridge' }));
    await userEvent.click(screen.getByRole('button', { name: 'Last 12 months' }));

    expect(screen.getByText('+24 000 €')).toBeInTheDocument();
  });

  it('drops the toggle when both spans are the same two check-ins', () => {
    renderMovement({ trailing: monthly });

    expect(screen.queryByRole('button', { name: 'Monthly bridge' })).not.toBeInTheDocument();
    expect(screen.getByText('Jul 2026 → Aug 2026 · 1 month')).toBeInTheDocument();
  });

  it('falls back to whichever span exists', () => {
    renderMovement({ trailing: null });

    expect(screen.getByText('Jul 2026 → Aug 2026 · 1 month')).toBeInTheDocument();
  });

  it('renders nothing without a pair of check-ins to compare', () => {
    const { container } = renderMovement({ trailing: null, monthly: null });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('the split', () => {
  it('separates new capital from what the market did', () => {
    renderMovement();

    expect(screen.getByText('Capital contributed')).toBeInTheDocument();
    expect(screen.getByText('+18 000 €')).toBeInTheDocument();
    expect(screen.getByText('Market return')).toBeInTheDocument();
    expect(screen.getByText('+6000 €')).toBeInTheDocument();
  });

  it('signs a withdrawal and a losing year the way they read', () => {
    renderMovement({
      trailing: { ...trailing, netWorthChange: -5000, contributions: -4121, marketGrowth: -879 }
    });

    expect(screen.getByText('−5000 €')).toBeInTheDocument();
    expect(screen.getByText('−4121 €')).toBeInTheDocument();
    expect(screen.getByText('−879 €')).toBeInTheDocument();
  });

  it('keeps the change but withholds the split when the span is not covered', () => {
    renderMovement({ trailing: { ...trailing, complete: false } });

    // The two check-ins say what the change was whatever the transactions do.
    expect(screen.getByText('+24 000 €')).toBeInTheDocument();
    expect(screen.queryByText('Capital contributed')).not.toBeInTheDocument();
    expect(screen.getByText(/needs transactions covering every month/)).toBeInTheDocument();
  });
});
