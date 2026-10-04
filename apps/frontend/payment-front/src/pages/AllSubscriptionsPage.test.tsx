import { render, screen } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../services/paymentApi', () => ({
  paymentApi: { listMySubscriptions: vi.fn() }
}));

import { paymentApi } from '../services/paymentApi';
import AllSubscriptionsPage from './AllSubscriptionsPage';

const mockedListMySubscriptions = paymentApi.listMySubscriptions as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows a loading message before subscriptions arrive', () => {
  mockedListMySubscriptions.mockReturnValue(new Promise(() => {}));
  render(<AllSubscriptionsPage />);
  expect(screen.getByText(/loading subscriptions/i)).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedListMySubscriptions.mockRejectedValue(new Error('boom'));
  render(<AllSubscriptionsPage />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message when the rejection has none', async () => {
  mockedListMySubscriptions.mockRejectedValue({});
  render(<AllSubscriptionsPage />);
  expect(await screen.findByText('Failed')).toBeInTheDocument();
});

it('renders a row per subscription with formatted dates and dashed fallbacks', async () => {
  mockedListMySubscriptions.mockResolvedValue([
    {
      _id: 's1',
      planCode: 'pro',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      renewsAt: '2024-02-01T00:00:00.000Z'
    },
    {
      _id: 's2',
      planCode: 'free',
      status: 'canceled',
      canceledAt: '2024-03-01T00:00:00.000Z'
    }
  ]);

  render(<AllSubscriptionsPage />);

  expect(await screen.findByText('All Subscriptions')).toBeInTheDocument();
  expect(screen.getByText('pro')).toBeInTheDocument();
  expect(screen.getByText('active')).toBeInTheDocument();
  expect(screen.getByText('free')).toBeInTheDocument();
  expect(screen.getByText('canceled')).toBeInTheDocument();
  // s2 has no renewsAt and s1 has no canceledAt -> dashed fallbacks present
  expect(screen.getAllByText('-').length).toBe(2);
});

it('falls back to the default chip color for an unrecognized status', async () => {
  mockedListMySubscriptions.mockResolvedValue([{ _id: 's1', planCode: 'pro', status: 'unknown_status' as never }]);

  render(<AllSubscriptionsPage />);

  expect(await screen.findByText('unknown_status')).toBeInTheDocument();
});
