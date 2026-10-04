import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock('../services/paymentApi', () => ({
  paymentApi: { listPlans: vi.fn(), getMySubscription: vi.fn() }
}));

import { paymentApi } from '../services/paymentApi';
import PlansPage from './PlansPage';

const mockedListPlans = paymentApi.listPlans as unknown as ReturnType<typeof vi.fn>;
const mockedGetMySubscription = paymentApi.getMySubscription as unknown as ReturnType<typeof vi.fn>;

const plans = [
  { _id: 'p1', code: 'free', name: 'Free', priceMonthlyCents: 0 },
  {
    _id: 'p2',
    code: 'pro',
    name: 'Pro',
    priceMonthlyCents: 1999,
    description: 'For professionals',
    features: ['50 GB storage', 'Priority support']
  },
  { _id: 'p3', code: 'elite', name: 'Elite', priceMonthlyCents: 4999, features: ['500 GB storage'] }
];

function renderPage() {
  return render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

it('shows a loading message before plans arrive', () => {
  mockedListPlans.mockReturnValue(new Promise(() => {}));
  mockedGetMySubscription.mockResolvedValue(null);
  renderPage();
  expect(screen.getByText(/loading plans/i)).toBeInTheDocument();
});

it('shows an error message when loading fails', async () => {
  mockedListPlans.mockRejectedValue(new Error('boom'));
  renderPage();
  expect(await screen.findByText(/error loading plans: boom/i)).toBeInTheDocument();
});

it('shows a generic error message for a non-Error rejection', async () => {
  mockedListPlans.mockRejectedValue('nope');
  renderPage();
  expect(await screen.findByText(/error loading plans: failed to load plans/i)).toBeInTheDocument();
});

it('tolerates getMySubscription failing (falls back to no subscription)', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockRejectedValue(new Error('down'));
  renderPage();

  expect(await screen.findAllByText('Get Started')).toHaveLength(3);
});

it('shows "Get Started" for every plan with no subscription', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockResolvedValue(null);
  renderPage();

  expect(await screen.findAllByText('Get Started')).toHaveLength(3);
  expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
  expect(screen.getByText('19.99 €')).toBeInTheDocument();
});

it('renders the features and description stored on the plan', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockResolvedValue(null);
  renderPage();

  expect(await screen.findByText('50 GB storage')).toBeInTheDocument();
  expect(screen.getByText('Priority support')).toBeInTheDocument();
  expect(screen.getByText('500 GB storage')).toBeInTheDocument();
  expect(screen.getByText('For professionals')).toBeInTheDocument();
});

it('renders a placeholder for a plan with no features rather than inventing limits', async () => {
  mockedListPlans.mockResolvedValue([{ _id: 'p9', code: 'mystery', name: 'Mystery', priceMonthlyCents: 500 }]);
  mockedGetMySubscription.mockResolvedValue(null);
  renderPage();

  expect(await screen.findByText(/no features listed/i)).toBeInTheDocument();
});

it('disables the button and labels it "Current Plan" for the active plan, and shows "Change Plan" for others', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  renderPage();

  expect(await screen.findByRole('button', { name: 'Current Plan' })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'Change Plan' }).length).toBe(1); // elite only (free is a "Switch to Free" case)
  expect(screen.getByRole('button', { name: 'Switch to Free' })).toBeInTheDocument();
});

it('navigates to checkout with the plan code when a plan button is clicked', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockResolvedValue(null);
  renderPage();

  const button = await screen.findAllByText('Get Started');
  await userEvent.click(button[1]); // pro plan

  expect(mockedNavigate).toHaveBeenCalledWith('/payments/subscription/checkout?plan=pro');
});

it('navigates when switching to the free plan', async () => {
  mockedListPlans.mockResolvedValue(plans);
  mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
  renderPage();

  await userEvent.click(await screen.findByRole('button', { name: 'Switch to Free' }));

  expect(mockedNavigate).toHaveBeenCalledWith('/payments/subscription/checkout?plan=free');
});

describe('a granted (non-public) plan', () => {
  // The API returns a non-public plan only to the account that holds it, so its
  // presence on this page means it is the caller's own plan.
  const staffPlan = {
    _id: 'p4',
    code: 'staff',
    name: 'Staff',
    priceMonthlyCents: 0,
    isPublic: false,
    features: ['Everything, without limits']
  };

  it('is shown to the member it belongs to, marked as granted and complimentary', async () => {
    mockedListPlans.mockResolvedValue([...plans, staffPlan]);
    mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'staff', status: 'active' });
    renderPage();

    expect(await screen.findByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Granted')).toBeInTheDocument();
    expect(screen.getByText('Complimentary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled();
  });

  it('offers no checkout on the other plans, since buying one would change nothing', async () => {
    mockedListPlans.mockResolvedValue([...plans, staffPlan]);
    mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'staff', status: 'active' });
    renderPage();

    const covered = await screen.findAllByRole('button', { name: /covered by staff/i });
    expect(covered).toHaveLength(plans.length);
    covered.forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Change Plan' })).not.toBeInTheDocument();
  });

  it('leaves the ordinary catalog untouched for everyone else', async () => {
    mockedListPlans.mockResolvedValue(plans);
    mockedGetMySubscription.mockResolvedValue({ _id: 's1', planCode: 'pro', status: 'active' });
    renderPage();

    expect(await screen.findByRole('button', { name: 'Current Plan' })).toBeDisabled();
    expect(screen.queryByText('Granted')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /covered by/i })).not.toBeInTheDocument();
  });
});
