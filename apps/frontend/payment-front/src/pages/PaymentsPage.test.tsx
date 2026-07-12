import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../components/tabs/PlansTab', () => ({ default: () => <div>plans tab content</div> }));
vi.mock('../components/tabs/SubscriptionsTab', () => ({ default: () => <div>subscriptions tab content</div> }));
vi.mock('../components/tabs/PaymentsTab', () => ({ default: () => <div>payments tab content</div> }));

import PaymentsPage from './PaymentsPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/payments/*" element={<PaymentsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

it('defaults to the Plans tab at the bare /payments path', async () => {
  renderAt('/payments');
  expect(await screen.findByText('plans tab content')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Plans' })).toHaveAttribute('aria-selected', 'true');
});

it('selects the Subscriptions tab', async () => {
  renderAt('/payments/subscriptions');
  expect(await screen.findByText('subscriptions tab content')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Subscriptions' })).toHaveAttribute('aria-selected', 'true');
});

it('selects the Payments (history) tab', async () => {
  renderAt('/payments/history');
  expect(await screen.findByText('payments tab content')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Payments' })).toHaveAttribute('aria-selected', 'true');
});

it('navigates when a different tab is clicked', async () => {
  renderAt('/payments/plans');
  await screen.findByText('plans tab content');

  await userEvent.click(screen.getByRole('tab', { name: 'Subscriptions' }));

  expect(await screen.findByText('subscriptions tab content')).toBeInTheDocument();
});

it('navigates to the Payments tab from the tab bar', async () => {
  renderAt('/payments/plans');
  await screen.findByText('plans tab content');

  await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));

  expect(await screen.findByText('payments tab content')).toBeInTheDocument();
});
