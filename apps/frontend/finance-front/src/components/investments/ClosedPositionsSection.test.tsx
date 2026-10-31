import { render, screen } from '@testing-library/react';
import ClosedPositionsSection from './ClosedPositionsSection';
import type { ClosedPosition } from '../../services/holdingService';

const position = (over: Partial<ClosedPosition> = {}): ClosedPosition => ({
  ticker: 'ZPRR.DEX',
  displayName: 'SPDR Russell 2000',
  currency: 'EUR',
  baseCurrency: 'EUR',
  firstTradeDate: '2023-07-14',
  closedDate: '2025-01-02',
  bought: 9978,
  proceeds: 12380,
  realizedGain: 2402,
  dividends: 0,
  totalReturn: 2402,
  fees: 0,
  tradeCount: 2,
  missingFxRate: false,
  ...over
});

it('renders nothing when no position was ever sold out', () => {
  const { container } = render(<ClosedPositionsSection positions={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it('shows what a sold position made, when it was held and what it paid out', () => {
  render(<ClosedPositionsSection positions={[position({ dividends: 176.36, totalReturn: 2578.36 })]} />);

  expect(screen.getByText('Sold positions')).toBeInTheDocument();
  expect(screen.getByText('ZPRR.DEX')).toBeInTheDocument();
  expect(screen.getByText('2023-07-14 → 2025-01-02')).toBeInTheDocument();
  expect(screen.getAllByText('+2402 €').length).toBeGreaterThan(0);
  expect(screen.getAllByText('176,36 €').length).toBeGreaterThan(0);
});

it('adds the positions up in a total row', () => {
  render(
    <ClosedPositionsSection
      positions={[
        position(),
        position({ ticker: 'VGWD.DEX', realizedGain: 25, dividends: 176.36, totalReturn: 201.36 })
      ]}
    />
  );

  // 2402 + 25 realised, 0 + 176.36 dividends, 2402 + 201.36 in all (whole euros)
  expect(screen.getByText('+2427 €')).toBeInTheDocument();
  expect(screen.getByText('+2603 €')).toBeInTheDocument();
});

it('shows a loss as a loss', () => {
  render(<ClosedPositionsSection positions={[position({ realizedGain: -300, totalReturn: -300 })]} />);

  expect(screen.getAllByText(/^[-\u2212]300 €$/).length).toBeGreaterThan(0);
});

it('leaves a position with no exchange rate out of the totals rather than guessing', () => {
  render(
    <ClosedPositionsSection
      positions={[
        position(),
        position({
          ticker: 'US.DEX',
          currency: 'USD',
          missingFxRate: true,
          bought: undefined,
          proceeds: undefined,
          realizedGain: undefined,
          dividends: undefined,
          totalReturn: undefined
        })
      ]}
    />
  );

  // the footer is the first position alone
  expect(screen.getAllByText('+2402 €').length).toBeGreaterThanOrEqual(3);
});
