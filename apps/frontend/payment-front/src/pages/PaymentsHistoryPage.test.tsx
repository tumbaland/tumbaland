import { render, screen } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../services/paymentApi', () => ({
  paymentApi: { listMyPayments: vi.fn() }
}));

import { paymentApi } from '../services/paymentApi';
import PaymentsHistoryPage from './PaymentsHistoryPage';

const mockedListMyPayments = paymentApi.listMyPayments as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a loading message before payments arrive', () => {
  mockedListMyPayments.mockReturnValue(new Promise(() => {}));
  render(<PaymentsHistoryPage />);
  expect(screen.getByText(/loading payments/i)).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedListMyPayments.mockRejectedValue(new Error('boom'));
  render(<PaymentsHistoryPage />);
  expect(await screen.findByText(/error loading payments: boom/i)).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedListMyPayments.mockRejectedValue('nope');
  render(<PaymentsHistoryPage />);
  expect(await screen.findByText(/error loading payments: failed/i)).toBeInTheDocument();
});

it('shows the empty state when there are no payments', async () => {
  mockedListMyPayments.mockResolvedValue([]);
  render(<PaymentsHistoryPage />);
  expect(await screen.findByText('No Payment History')).toBeInTheDocument();
});

it('renders a row per payment covering each status icon/color branch and the amount formatting', async () => {
  mockedListMyPayments.mockResolvedValue([
    {
      _id: 'p1',
      type: 'subscription',
      status: 'succeeded',
      amountCents: 1999,
      currency: 'usd',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    { _id: 'p2', type: 'one_time', status: 'failed', amountCents: 500, createdAt: '2024-01-02T00:00:00.000Z' },
    { _id: 'p3', type: 'one_time', status: 'pending', createdAt: '2024-01-03T00:00:00.000Z' }, // no amountCents -> '—'
    { _id: 'p4', type: 'one_time', status: 'refunded', amountCents: 100, createdAt: '2024-01-04T00:00:00.000Z' } // default branch
  ]);

  render(<PaymentsHistoryPage />);

  expect(await screen.findByText('19.99 USD')).toBeInTheDocument();
  expect(screen.getByText('5.00 EUR')).toBeInTheDocument(); // defaults currency to EUR
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByText('succeeded')).toBeInTheDocument();
  expect(screen.getByText('failed')).toBeInTheDocument();
  expect(screen.getByText('pending')).toBeInTheDocument();
  expect(screen.getByText('refunded')).toBeInTheDocument();
});
