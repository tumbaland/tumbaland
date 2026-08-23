import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../services/entitlementsService', () => ({ getMyEntitlements: vi.fn() }));

import { PlanUsageCard } from './PlanUsageCard';
import { getMyEntitlements } from '../../services/entitlementsService';

const GB = 1024 ** 3;
const mocked = getMyEntitlements as ReturnType<typeof vi.fn>;

const FREE = {
  email: 'toomas@example.com',
  planCode: 'free',
  status: null,
  limits: {
    meters: { storageBytes: GB, aiJobs: 25, trackedTickers: 3, seats: 1 },
    features: { cleanExport: false },
    retentionDays: 90
  },
  usage: { storageBytes: 0.5 * GB, aiJobs: 0, trackedTickers: 2, seats: 1 }
};

function renderCard() {
  return render(
    <MemoryRouter>
      <PlanUsageCard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigate.mockReset();
  mocked.mockReset();
  mocked.mockResolvedValue(FREE);
});

it('shows a free account what it has used out of what it is allowed', async () => {
  renderCard();

  expect(await screen.findByText('512 MB of 1 GB')).toBeInTheDocument();
  expect(screen.getByText('2 of 3')).toBeInTheDocument();
  expect(screen.getByText('Free')).toBeInTheDocument();
  expect(screen.getByText('History is kept for 90 days')).toBeInTheDocument();
});

it('shows usage without a ceiling on an unlimited plan', async () => {
  mocked.mockResolvedValue({
    ...FREE,
    planCode: 'staff',
    isComp: true,
    limits: {
      meters: { storageBytes: -1, aiJobs: -1, trackedTickers: -1, seats: -1 },
      features: { cleanExport: true },
      retentionDays: -1
    }
  });
  renderCard();

  expect(await screen.findByText('Staff · complimentary')).toBeInTheDocument();
  expect(screen.getAllByText('Unlimited on your plan')).toHaveLength(2);
  expect(screen.getByText('Full history, as far back as it goes')).toBeInTheDocument();
});

it('advertises no meter that nothing enforces', async () => {
  // `aiJobs` has no dispatch chokepoint and `seats` is metered but unwired, so
  // neither is a claim this card is allowed to make (MONETIZATION.md 3.1).
  renderCard();
  await screen.findByText('512 MB of 1 GB');

  expect(screen.queryByText(/AI/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/seats?/i)).not.toBeInTheDocument();
});

it('routes to the plans page rather than to a checkout', async () => {
  const user = userEvent.setup();
  renderCard();

  await user.click(await screen.findByRole('button', { name: 'See plans' }));

  expect(navigate).toHaveBeenCalledWith('/payments');
});

it('hides itself rather than showing an error when the lookup fails', async () => {
  mocked.mockRejectedValue(new Error('payment-service down'));
  const { container } = renderCard();

  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
