import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/paymentApi', () => ({
  paymentApi: {
    listPlans: vi.fn(),
    createCheckoutSession: vi.fn(),
    getCheckoutSessionStatus: vi.fn()
  }
}));

import { paymentApi } from '../services/paymentApi';
import SubscriptionCheckoutPage from './SubscriptionCheckoutPage';

const mockedListPlans = paymentApi.listPlans as unknown as ReturnType<typeof vi.fn>;
const mockedCreateCheckoutSession = paymentApi.createCheckoutSession as unknown as ReturnType<typeof vi.fn>;
const mockedGetCheckoutSessionStatus = paymentApi.getCheckoutSessionStatus as unknown as ReturnType<typeof vi.fn>;

const freePlan = { _id: 'p1', code: 'free', name: 'Free', priceMonthlyCents: 0 };
const proPlan = { _id: 'p2', code: 'pro', name: 'Pro', priceMonthlyCents: 1999, description: 'For pros' };

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SubscriptionCheckoutPage />
    </MemoryRouter>
  );
}

function stubLocation() {
  const originalLocation = window.location;
  const assign = vi.fn();
  Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, assign, href: originalLocation.href } });
  return { assign, restore: () => Object.defineProperty(window, 'location', { writable: true, value: originalLocation }) };
}

beforeEach(() => vi.clearAllMocks());

it('skips plan loading and does not fetch plans when there is no plan param', async () => {
  renderAt('/subscription/checkout');
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  expect(mockedListPlans).not.toHaveBeenCalled();
  expect(screen.getByText('Finalizing checkout...')).toBeInTheDocument();
});

it('shows a warning when the plan code does not match any plan', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  renderAt('/subscription/checkout?plan=unknown');
  expect(await screen.findByText('Plan not found.')).toBeInTheDocument();
});

it('shows an error message when loading plans fails', async () => {
  mockedListPlans.mockRejectedValue(new Error('boom'));
  renderAt('/subscription/checkout?plan=pro');
  expect(await screen.findByText('boom')).toBeInTheDocument();
});

it('shows a generic error message when the rejection has no message', async () => {
  mockedListPlans.mockRejectedValue({});
  renderAt('/subscription/checkout?plan=pro');
  expect(await screen.findByText('Failed to load plan')).toBeInTheDocument();
});

it('renders the free plan order summary with an Activate button and no terms gate', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  renderAt('/subscription/checkout?plan=free');

  expect(await screen.findAllByText('Free')).not.toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Activate Free Plan' })).toBeEnabled();
  expect(screen.queryByText(/agree to the/i)).not.toBeInTheDocument();
});

it('renders the paid plan order summary with a terms checkbox gating the Proceed button', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  renderAt('/subscription/checkout?plan=pro');

  expect(await screen.findByText('For pros')).toBeInTheDocument();
  expect(screen.getByText('19.99 € / month')).toBeInTheDocument();
  const proceedButton = screen.getByRole('button', { name: 'Proceed to Payment' });
  expect(proceedButton).toBeDisabled();

  await userEvent.click(screen.getByRole('checkbox'));
  expect(proceedButton).toBeEnabled();
});

it('activates a free plan and navigates to the returned url', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ free: true, url: '/subscription', subscription: { status: 'active' } });
  const { assign, restore } = stubLocation();
  renderAt('/subscription/checkout?plan=free');

  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  expect(mockedCreateCheckoutSession).toHaveBeenCalledWith('free');
  await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('/subscription')));
  restore();
});

it('redirects to a Stripe checkout url for a paid plan', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/abc', sessionId: 'cs_123' });
  const { assign, restore } = stubLocation();
  renderAt('/subscription/checkout?plan=pro');

  await userEvent.click(await screen.findByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Proceed to Payment' }));

  expect(await screen.findByRole('button', { name: 'Redirecting…' })).toBeInTheDocument();
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/pay/abc'));
  restore();
});

it('falls back to a constructed Stripe url when only a cs_ sessionId is returned', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ sessionId: 'cs_abc123' });
  const { assign, restore } = stubLocation();
  renderAt('/subscription/checkout?plan=pro');

  await userEvent.click(await screen.findByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Proceed to Payment' }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_abc123'));
  restore();
});

it('falls back to /subscription when the response has neither a free-active flag nor a url', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  mockedCreateCheckoutSession.mockResolvedValue({});
  const { assign, restore } = stubLocation();
  renderAt('/subscription/checkout?plan=pro');

  await userEvent.click(await screen.findByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Proceed to Payment' }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('/subscription')));
  restore();
});

it('shows an error message when starting checkout fails', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockRejectedValue(new Error('stripe down'));
  renderAt('/subscription/checkout?plan=free');

  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  expect(await screen.findByText('stripe down')).toBeInTheDocument();
});

it('shows a generic error message when starting checkout fails without an Error', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockRejectedValue('nope');
  renderAt('/subscription/checkout?plan=free');

  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  expect(await screen.findByText('Failed to start checkout')).toBeInTheDocument();
});

it('shows the "processing payment" panel when returning from Stripe with status=success', async () => {
  mockedGetCheckoutSessionStatus.mockReturnValue(new Promise(() => {})); // keep polling pending
  renderAt('/subscription/checkout?status=success&session_id=sess_1');

  expect(await screen.findByText(/processing payment/i)).toBeInTheDocument();
  expect(screen.getByText(/subscription will activate shortly/i)).toBeInTheDocument();
});

it('shows the canceled panel when returning from Stripe with status=cancel', async () => {
  renderAt('/subscription/checkout?status=cancel');
  expect(await screen.findByText(/payment canceled/i)).toBeInTheDocument();
});

it('redirects once polling finds an active subscription', async () => {
  mockedGetCheckoutSessionStatus.mockResolvedValue({ status: 'processing', payment_status: 'unpaid', subscription: { status: 'active' } });
  const { assign, restore } = stubLocation();
  renderAt('/subscription/checkout?status=success&session_id=sess_1');

  await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('/subscription')));
  restore();
});

it('shows an error after polling reports the session complete without an active subscription for 3+ attempts', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockedGetCheckoutSessionStatus.mockResolvedValue({ status: 'complete', payment_status: 'paid', subscription: null });
  renderAt('/subscription/checkout?status=success&session_id=sess_1');

  // 3 attempts at ~2s backoff each
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(2000);

  expect(await screen.findByText(/awaiting confirmation/i)).toBeInTheDocument();
  vi.useRealTimers();
});

it('shows a network-issue error after several failed polling attempts', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockedGetCheckoutSessionStatus.mockRejectedValue(new Error('network'));
  renderAt('/subscription/checkout?status=success&session_id=sess_1');

  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(2000);
  }

  expect(await screen.findByText(/network issue while checking status/i)).toBeInTheDocument();
  vi.useRealTimers();
});

it('gives up after ~30 polling attempts with no resolution', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockedGetCheckoutSessionStatus.mockResolvedValue({ status: 'processing', payment_status: 'unpaid', subscription: null });
  renderAt('/subscription/checkout?status=success&session_id=sess_1');

  // Cumulative backoff easily exceeds what's needed for 30 attempts regardless of tier.
  await vi.advanceTimersByTimeAsync(400000);

  expect(await screen.findByText(/still processing after several minutes/i)).toBeInTheDocument();
  vi.useRealTimers();
});

it('navigates the top frame directly when embedded in a same-origin iframe', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ free: true, url: '/subscription', subscription: { status: 'active' } });

  const assign = vi.fn();
  const originalTop = window.top;
  Object.defineProperty(window, 'top', {
    configurable: true,
    value: { location: { href: 'https://app.example/', assign } }
  });

  renderAt('/subscription/checkout?plan=free');
  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('/subscription')));
  Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
});

it('falls back to postMessage + window.open when the top frame is cross-origin', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ free: true, url: '/subscription', subscription: { status: 'active' } });

  const postMessage = vi.fn();
  const originalTop = window.top;
  Object.defineProperty(window, 'top', {
    configurable: true,
    value: {
      get location(): never {
        throw new Error('cross-origin');
      }
    }
  });
  Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
  const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

  renderAt('/subscription/checkout?plan=free');
  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  await waitFor(() => expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'tumbaland:navigate-top' }),
    '*'
  ));
  expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/subscription'), '_top');

  openSpy.mockRestore();
  Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
});

it('falls back to a synthetic anchor click when window.open is blocked in a cross-origin iframe', async () => {
  mockedListPlans.mockResolvedValue([freePlan]);
  mockedCreateCheckoutSession.mockResolvedValue({ free: true, url: '/subscription', subscription: { status: 'active' } });

  const originalTop = window.top;
  Object.defineProperty(window, 'top', {
    configurable: true,
    value: {
      get location(): never {
        throw new Error('cross-origin');
      }
    }
  });
  Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage: vi.fn() } });
  const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderAt('/subscription/checkout?plan=free');
  await userEvent.click(await screen.findByRole('button', { name: 'Activate Free Plan' }));

  await waitFor(() => expect(clickSpy).toHaveBeenCalled());

  openSpy.mockRestore();
  clickSpy.mockRestore();
  Object.defineProperty(window, 'top', { configurable: true, value: originalTop });
});

it('closes the Terms dialog via its onClose handler (e.g. Escape/backdrop)', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  renderAt('/subscription/checkout?plan=pro');
  await screen.findByText('For pros');

  await userEvent.click(screen.getByText('Terms and Conditions'));
  expect(await screen.findByRole('heading', { name: 'Terms and Conditions' })).toBeInTheDocument();

  await userEvent.keyboard('{Escape}');

  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Terms and Conditions' })).not.toBeInTheDocument());
});

it('opens and closes the Terms and Conditions dialog', async () => {
  mockedListPlans.mockResolvedValue([proPlan]);
  renderAt('/subscription/checkout?plan=pro');
  await screen.findByText('For pros');

  await userEvent.click(screen.getByText('Terms and Conditions'));
  expect(await screen.findByRole('heading', { name: 'Terms and Conditions' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Terms and Conditions' })).not.toBeInTheDocument());
});
