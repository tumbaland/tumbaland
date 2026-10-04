import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vite-plus/test';

/**
 * A stand-in for this app's real routes, with the shape that matters: its
 * paths are *relative*, so whether they match at all depends on the prefix
 * being matched above them. A mock that rendered unconditionally would pass
 * either way and prove nothing.
 */
vi.mock('../routes', () => ({
  default: () => (
    <Routes>
      <Route path="dashboard" element={<div>app pages</div>} />
      <Route path="" element={<div>app index</div>} />
    </Routes>
  )
}));
vi.mock('../config/ConfigProvider', () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import RemoteApp from './RemoteApp';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RemoteApp />
    </MemoryRouter>
  );

it('renders its pages at the address the shell mounts it on', () => {
  // The shell renders this outside any <Route>, so the prefix has to be
  // matched in here. Without it this app's relative routes were matched
  // against the whole address, matched nothing, and rendered a blank page.
  renderAt('/account/dashboard');

  expect(screen.getByText('app pages')).toBeInTheDocument();
});

it('renders its index page at its own root', () => {
  renderAt('/account');

  expect(screen.getByText('app index')).toBeInTheDocument();
});

it('renders nothing for an address that belongs to another module', () => {
  renderAt('/somewhere-else/dashboard');

  expect(screen.queryByText('app pages')).not.toBeInTheDocument();
  expect(screen.queryByText('app index')).not.toBeInTheDocument();
});
