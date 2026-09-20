import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { vi } from 'vitest';

vi.mock('../components/tabs/PlansTab', () => ({ default: () => <div>plans tab content</div> }));
vi.mock('../components/tabs/SubscriptionsTab', () => ({ default: () => <div>subscriptions tab content</div> }));
vi.mock('../components/tabs/PaymentsTab', () => ({ default: () => <div>payments tab content</div> }));

import PaymentsPage from './PaymentsPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[`/payments${path === '/' ? '' : path}`]}>
      <Routes>
        <Route path="/payments/*" element={<PaymentsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

it('defaults to the Plans section at the bare root path', async () => {
  renderAt('/');
  expect(await screen.findByText('plans tab content')).toBeInTheDocument();
});

it('renders the Subscriptions section', async () => {
  renderAt('/subscriptions');
  expect(await screen.findByText('subscriptions tab content')).toBeInTheDocument();
});

it('renders the Payments (history) section', async () => {
  renderAt('/history');
  expect(await screen.findByText('payments tab content')).toBeInTheDocument();
});

it('draws no navigation of its own: the header bar names the sections', async () => {
  renderAt('/plans');
  await screen.findByText('plans tab content');

  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});
