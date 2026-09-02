import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecurringPayments from './RecurringPayments';
import { RecurringPayment, RecurringReport } from '../../services/cashflowService';

const payment = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  key: 'spotify ab',
  merchant: 'SPOTIFY AB',
  category: 'Subscriptions',
  cadence: 'monthly',
  intervalDays: 30,
  occurrences: 6,
  regularity: 1,
  amount: 11.99,
  amountVariation: 0,
  monthlyEquivalent: 12.17,
  yearlyEquivalent: 145.98,
  firstCharge: '2026-04-01',
  lastCharge: '2026-09-01',
  nextExpected: '2026-10-01',
  daysUntilNext: 28,
  status: 'active',
  priceChange: null,
  ...over
});

const report = (over: Partial<RecurringReport> = {}): RecurringReport => ({
  from: '2024-09-01',
  to: '2026-09-03',
  monthlyTotal: 12.17,
  yearlyTotal: 145.98,
  lapsedCount: 0,
  payments: [payment()],
  ...over
});

const rowFor = (merchant: string) => screen.getByText(merchant).closest('tr') as HTMLElement;

it('explains the bar a charge has to clear when nothing was detected', () => {
  render(<RecurringPayments report={report({ payments: [], monthlyTotal: 0, yearlyTotal: 0 })} />);

  expect(screen.getByText(/at least three times/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('heads the list with what the running subscriptions cost', () => {
  render(<RecurringPayments report={report()} />);

  expect(screen.getByText(/12[.,]17.*a month/)).toBeInTheDocument();
  expect(screen.getByText(/145[.,]98.*a year/)).toBeInTheDocument();
  expect(screen.getByText(/across 1 still running/)).toBeInTheDocument();
});

it('counts the stopped ones separately from the running ones', () => {
  render(
    <RecurringPayments
      report={report({ payments: [payment(), payment({ key: 'gone', merchant: 'OLD CO', status: 'lapsed' })], lapsedCount: 1 })}
    />
  );

  expect(screen.getByText(/across 1 still running \(1 stopped\)/)).toBeInTheDocument();
});

it('shows the charge, its cycle and both derived costs', () => {
  render(<RecurringPayments report={report()} />);

  const row = within(rowFor('SPOTIFY AB'));
  expect(row.getByText('Monthly')).toBeInTheDocument();
  expect(row.getByText('Subscriptions')).toBeInTheDocument();
  expect(row.getByText(/11[.,]99/)).toBeInTheDocument();
  expect(row.getByText(/145[.,]98/)).toBeInTheDocument();
});

it('names the cadence for a cycle that is not monthly', () => {
  render(<RecurringPayments report={report({ payments: [payment({ cadence: 'biweekly' })] })} />);
  expect(screen.getByText('Every 2 weeks')).toBeInTheDocument();
});

it('flags a charge that moves around as variable', () => {
  render(<RecurringPayments report={report({ payments: [payment({ amountVariation: 0.4 })] })} />);
  expect(screen.getByText('varies')).toBeInTheDocument();
});

it('leaves a steady charge unflagged', () => {
  render(<RecurringPayments report={report()} />);
  expect(screen.queryByText('varies')).not.toBeInTheDocument();
});

it('says when the next charge is due', () => {
  render(<RecurringPayments report={report()} />);
  expect(screen.getByText(/due Oct 1/)).toBeInTheDocument();
});

it('says "due today" rather than a date on the day itself', () => {
  render(<RecurringPayments report={report({ payments: [payment({ daysUntilNext: 0 })] })} />);
  expect(screen.getByText('due today')).toBeInTheDocument();
});

it('calls out a charge that has not arrived when it should have', () => {
  render(<RecurringPayments report={report({ payments: [payment({ status: 'due', daysUntilNext: -6 })] })} />);
  expect(screen.getByText(/overdue since Oct 1/)).toBeInTheDocument();
});

it('shows a stopped subscription as ended, at its last charge', () => {
  render(<RecurringPayments report={report({ payments: [payment({ status: 'lapsed', daysUntilNext: -200 })], lapsedCount: 1 })} />);
  expect(screen.getByText(/stopped after Sep 1/)).toBeInTheDocument();
});

it('shows a price rise with what it used to cost', () => {
  render(
    <RecurringPayments
      report={report({
        payments: [payment({ priceChange: { previousAmount: 9.99, currentAmount: 11.99, changedOn: '2026-09-01' } })]
      })}
    />
  );

  expect(screen.getByText(/9[.,]99.*→.*11[.,]99/)).toBeInTheDocument();
});

it('reports how many charges the detection rests on', async () => {
  render(<RecurringPayments report={report()} />);

  await userEvent.hover(screen.getByText('SPOTIFY AB'));

  expect(await screen.findByText(/6 charges since Apr 1, 100% on cycle/)).toBeInTheDocument();
});
