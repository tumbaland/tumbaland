import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

vi.mock('../components/tabs/ProfileTab', () => ({
  default: () => <div>profile tab content</div>
}));

vi.mock('../components/tabs/ApiKeysTab', () => ({
  default: () => <div>api keys tab content</div>
}));

vi.mock('../components/tabs/ConnectionsTab', () => ({
  default: () => <div>connections tab content</div>
}));

import AccountPage from './AccountPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[`/account${path === '/' ? '' : path}`]}>
      <Routes>
        <Route path="/account/*" element={<AccountPage />} />
      </Routes>
    </MemoryRouter>
  );
}

it('redirects the bare account path to the profile section', () => {
  renderAt('/');
  expect(screen.getByText('profile tab content')).toBeInTheDocument();
});

it('renders the API keys section at its own path', () => {
  renderAt('/api-keys');

  expect(screen.getByText('api keys tab content')).toBeInTheDocument();
});

it('renders nothing for a path with no section of its own', () => {
  // The page no longer guesses: a path it does not own matches no route rather
  // than falling back to whatever the first tab happened to be.
  renderAt('/security');

  expect(screen.queryByText('profile tab content')).not.toBeInTheDocument();
});

it('draws no navigation of its own: the header bar names the sections', () => {
  // Inside the shell this page sits directly under the shell's header, so a
  // tab row here was a second navigation stacked on the first.
  renderAt('/profile');

  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});

describe('keys and connections are two sections', () => {
  it('renders connections at its own path', () => {
    renderAt('/connections');

    expect(screen.getByText('connections tab content')).toBeInTheDocument();
    // The two used to be one screen, where "New key" sat above a list of things
    // no key was ever made for.
    expect(screen.queryByText('api keys tab content')).not.toBeInTheDocument();
  });

  it('keeps the keys section to keys alone', () => {
    renderAt('/api-keys');

    expect(screen.getByText('api keys tab content')).toBeInTheDocument();
    expect(screen.queryByText('connections tab content')).not.toBeInTheDocument();
  });
});
