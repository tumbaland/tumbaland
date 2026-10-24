import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ReactNode } from 'react';
import { vi } from 'vite-plus/test';

// Only ProtectedRoute is stubbed: the module also backs ConfigProvider, which
// authService pulls in transitively.
vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual<typeof import('@tumbaland/frontend-core')>('@tumbaland/frontend-core');
  return { ...actual, ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</> };
});
vi.mock('../pages/PaymentsPage', () => ({ default: () => <div>payments page</div> }));
vi.mock('../pages/SubscriptionCheckoutPage', () => ({ default: () => <div>checkout page</div> }));

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

// The tabs route is a splat, so the static checkout route only wins because React
// Router ranks static segments above splats regardless of declaration order.
it('ranks the static checkout route above the tabs splat', () => {
  renderAt('/subscription/checkout');
  expect(screen.getByText('checkout page')).toBeInTheDocument();
});

it("sends the old terms address on to the shell's single copy", () => {
  // Mounted the way the shell mounts it, beside the shell's own /terms.
  render(
    <MemoryRouter initialEntries={['/payments/terms']}>
      <Routes>
        <Route path="/payments/*" element={<AppRoutes />} />
        <Route path="/terms" element={<div>shell terms</div>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('shell terms')).toBeInTheDocument();
});
