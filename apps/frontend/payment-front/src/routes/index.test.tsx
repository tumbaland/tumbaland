import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ReactNode } from 'react';
import { vi } from 'vitest';

// Only ProtectedRoute is stubbed: the module also backs ConfigProvider, which
// authService pulls in transitively.
vi.mock('@tumbaland/components', async () => {
  const actual = await vi.importActual<typeof import('@tumbaland/components')>('@tumbaland/components');
  return { ...actual, ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock('../pages/PaymentsPage', () => ({ default: () => <div>payments page</div> }));
vi.mock('../pages/SubscriptionCheckoutPage', () => ({ default: () => <div>checkout page</div> }));
vi.mock('../pages/TermsPage', () => ({ default: () => <div>terms page</div> }));

import AppRoutes from './index';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );

it('serves the payments tabs at the root', () => {
  renderAt('/');
  expect(screen.getByText('payments page')).toBeInTheDocument();
});

it('serves the payments tabs on a nested tab path', () => {
  renderAt('/plans');
  expect(screen.getByText('payments page')).toBeInTheDocument();
});

// The tabs route is a splat, so these static siblings only win because React
// Router ranks static segments above splats regardless of declaration order.
it('ranks the static terms route above the tabs splat', () => {
  renderAt('/terms');
  expect(screen.getByText('terms page')).toBeInTheDocument();
});

it('ranks the static checkout route above the tabs splat', () => {
  renderAt('/subscription/checkout');
  expect(screen.getByText('checkout page')).toBeInTheDocument();
});
