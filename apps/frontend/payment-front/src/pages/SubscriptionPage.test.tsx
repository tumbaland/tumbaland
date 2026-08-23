import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/paymentApi', () => ({
  paymentApi: {
    getMySubscription: vi.fn(),
    listMySubscriptions: vi.fn(),
    cancelSubscription: vi.fn()
  }
}));

import { paymentApi } from '../services/paymentApi';
import SubscriptionPage from './SubscriptionPage';

const mockedGetMySubscription = paymentApi.getMySubscription as unknown as ReturnType<typeof vi.fn>;
const mockedListMySubscriptions = paymentApi.listMySubscriptions as unknown as ReturnType<typeof vi.fn>;
const mockedCancelSubscription = paymentApi.cancelSubscription as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedListMySubscriptions.mockResolvedValue([]);
});

it('shows a loading message before data arrives', () => {
  mockedGetMySubscription.mockReturnValue(new Promise(() => {}));
  render(<SubscriptionPage />);
  expect(screen.getByText(/loading subscription/i)).toBeInTheDocument();
});

it('shows the empty state when there is no active subscription', async () => {
  mockedGetMySubscription.mockResolvedValue(null);
  render(<SubscriptionPage />);
  expect(await screen.findByText('No Active Subscription')).toBeInTheDocument();
});

it('shows an error message when getMySubscription fails', async () => {
  mockedGetMySubscription.mockRejectedValue(new Error('boom'));
  render(<SubscriptionPage />);
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedGetMySubscription.mockRejectedValue('nope');
  render(<SubscriptionPage />);
  expect(await screen.findByText('Failed')).toBeInTheDocument();
});

it('tolerates listMySubscriptions failing by falling back to an empty history', async () => {
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  mockedListMySubscriptions.mockRejectedValue(new Error('history down'));
  render(<SubscriptionPage />);

  expect(await screen.findByText(/current plan: pro/i)).toBeInTheDocument();
  expect(screen.queryByText('Subscription History')).not.toBeInTheDocument();
});

it('shows renews/cancel dates when present, and disables Cancel for an already-canceled plan', async () => {
  mockedGetMySubscription.mockResolvedValue({
    _id: 's1',
    planCode: 'pro',
    status: 'canceled',
    renewsAt: '2024-06-01T00:00:00.000Z',
    cancelAt: '2024-07-01T00:00:00.000Z'
  });
  render(<SubscriptionPage />);

  expect(await screen.findByText(/renews:/i)).toBeInTheDocument();
  expect(screen.getByText(/ends:/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /cancel subscription/i })).toBeDisabled();
});

it('cancels the subscription and reloads', async () => {
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  mockedCancelSubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'canceled' });
  render(<SubscriptionPage />);
  await screen.findByText(/current plan: pro/i);

  await userEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

  expect(mockedCancelSubscription).toHaveBeenCalled();
  await waitFor(() => expect(mockedGetMySubscription).toHaveBeenCalledTimes(2));
});

it('reloads via the Refresh button', async () => {
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  render(<SubscriptionPage />);
  await screen.findByText(/current plan: pro/i);

  await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

  await waitFor(() => expect(mockedGetMySubscription).toHaveBeenCalledTimes(2));
});

it('shows subscription history excluding the current subscription, covering active/canceled/other status colors', async () => {
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  mockedListMySubscriptions.mockResolvedValue([
    { _id: 's1', planCode: 'pro', status: 'active' }, // filtered out (current)
    { _id: 's2', planCode: 'basic', status: 'active', createdAt: '2024-01-01T00:00:00.000Z', renewsAt: '2024-02-01T00:00:00.000Z' },
    { _id: 's3', planCode: 'free', status: 'canceled', canceledAt: '2024-03-01T00:00:00.000Z' },
    { _id: 's4', planCode: 'trial', status: 'past_due' }
  ]);

  render(<SubscriptionPage />);

  expect(await screen.findByText('Subscription History')).toBeInTheDocument();
  expect(screen.getByText('basic')).toBeInTheDocument();
  expect(screen.getByText('free')).toBeInTheDocument();
  expect(screen.getByText('trial')).toBeInTheDocument();
  // Missing fields render as '—': s2 has no canceledAt (1), s3 has no renewsAt (1),
  // s4 has neither renewsAt nor canceledAt (2) = 4 total.
  expect(screen.getAllByText('—').length).toBe(4);
});

describe('a complimentary subscription', () => {
  const comp = {
    _id: 's-comp',
    planCode: 'staff',
    status: 'active',
    isComp: true,
    grantReason: 'Maintainer account',
    expiresAt: '2026-12-31T00:00:00.000Z'
  };

  it('is labelled as granted, with its reason and expiry', async () => {
    mockedGetMySubscription.mockResolvedValue(comp);
    render(<SubscriptionPage />);

    expect(await screen.findByText('Complimentary')).toBeInTheDocument();
    expect(screen.getByText(/granted to you — Maintainer account/i)).toBeInTheDocument();
    expect(screen.getByText(/access until/i)).toBeInTheDocument();
  });

  it('disables Cancel — there is no billing to stop, and revoking is an admin action', async () => {
    mockedGetMySubscription.mockResolvedValue(comp);
    render(<SubscriptionPage />);

    expect(await screen.findByRole('button', { name: /cancel subscription/i })).toBeDisabled();
  });

  it('leaves a paid subscription cancellable', async () => {
    mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'support', status: 'active' });
    render(<SubscriptionPage />);

    expect(await screen.findByRole('button', { name: /cancel subscription/i })).toBeEnabled();
    expect(screen.queryByText('Complimentary')).not.toBeInTheDocument();
  });
});
