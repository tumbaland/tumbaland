import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { userList } from '../test/fixtures';

const api = vi.hoisted(() => ({ users: vi.fn() }));
vi.mock('../services/adminApi', () => ({ adminApi: api }));

import UsersPage from './UsersPage';

function Where() {
  const location = useLocation();
  return (
    <div data-testid="where" data-from={(location.state as { from?: string } | null)?.from ?? ''}>
      {location.pathname}
      {location.search}
    </div>
  );
}

const renderPage = (path = '/admin/users') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>
  );

const where = () => screen.getByTestId('where');

beforeEach(() => {
  vi.clearAllMocks();
  api.users.mockResolvedValue(userList());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UsersPage', () => {
  it('lists everyone with how much they use it', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Users' });
    const ada = within(table).getByRole('link', { name: 'Ada Lovelace' }).closest('tr')!;
    expect(within(ada).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(ada).getByText('12')).toBeInTheDocument();
    expect(within(ada).getByText('30')).toBeInTheDocument();
    expect(within(ada).getByText('Album, Journal')).toBeInTheDocument();
    expect(within(ada).getByText('support')).toBeInTheDocument();
    expect(within(ada).getByText('1.5 MB of 50 GB')).toBeInTheDocument();
    expect(within(ada).getByText('2, 1')).toBeInTheDocument();
  });

  it('links each person to their page', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/admin/users/u1');
  });

  it('shows an email alone for a person with no name, and flags what matters', async () => {
    renderPage();

    const bob = (await screen.findByRole('link', { name: 'bob@example.com' })).closest('tr')!;
    expect(within(bob).getByText('Admin')).toBeInTheDocument();
    expect(within(bob).getByText('Asked to be deleted')).toBeInTheDocument();
    expect(within(bob).getByLabelText('plan may be wrong')).toBeInTheDocument();
    expect(within(bob).getByText('Never')).toBeInTheDocument();
    expect(within(bob).getByText('-')).toBeInTheDocument();

    const cleo = screen.getByRole('link', { name: 'Cleo' }).closest('tr')!;
    expect(within(cleo).getByText('Closed')).toBeInTheDocument();
  });

  it('sorts by whoever was here last unless told otherwise', async () => {
    renderPage();

    await screen.findByRole('table', { name: 'Users' });
    expect(api.users).toHaveBeenCalledWith({ sort: 'lastVisit', page: 1, q: undefined });
  });

  it('sorts by what is chosen, from the first page', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Users' });

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }));
    await user.click(screen.getByRole('option', { name: 'Signed up' }));

    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith({ sort: 'signup', page: 1, q: undefined }));
  });

  it('searches once typing pauses, not on every letter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Users' });
    api.users.mockClear();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'ada');

    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith({ sort: 'lastVisit', page: 1, q: 'ada' }));
    // One search for the word, not three for its letters.
    expect(api.users.mock.calls.filter(([query]) => query.q !== undefined).length).toBe(1);
  });

  it('says nobody matches a search', async () => {
    api.users.mockResolvedValue(userList({ users: [], total: 0 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('No accounts yet.');

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz');

    expect(await screen.findByText('Nobody matches “zzz”.')).toBeInTheDocument();
  });

  it('counts the accounts, in the singular too', async () => {
    renderPage();
    expect(await screen.findByText('3 accounts')).toBeInTheDocument();
  });

  it('counts one account in the singular', async () => {
    api.users.mockResolvedValue(userList({ users: [userList().users[0]], total: 1 }));
    renderPage();
    expect(await screen.findByText('1 account')).toBeInTheDocument();
  });

  it('pages through a long list', async () => {
    api.users.mockResolvedValue(userList({ total: 60, totalPages: 3 }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: 'Users' });

    await user.click(screen.getByRole('button', { name: /page 2/i }));

    await waitFor(() => expect(api.users).toHaveBeenLastCalledWith({ sort: 'lastVisit', page: 2, q: undefined }));
  });

  it('shows no pager when there is one page', async () => {
    renderPage();
    await screen.findByRole('table', { name: 'Users' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
});

describe('the list in the address', () => {
  it('starts from the sort, page and search in the address', async () => {
    renderPage('/admin/users?sort=email&page=2&q=ada');

    await screen.findByRole('table', { name: 'Users' });
    expect(api.users).toHaveBeenCalledWith({ sort: 'email', page: 2, q: 'ada' });
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('ada');
  });

  it('ignores a sort it does not know and a page that is not a number', async () => {
    renderPage('/admin/users?sort=password&page=lots');

    await screen.findByRole('table', { name: 'Users' });
    expect(api.users).toHaveBeenCalledWith({ sort: 'lastVisit', page: 1, q: undefined });
  });

  it('writes a new search and sort into the address, back on the first page', async () => {
    const user = userEvent.setup();
    renderPage('/admin/users?page=3');
    await screen.findByRole('table', { name: 'Users' });

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'bob');
    await waitFor(() => expect(where()).toHaveTextContent('/admin/users?q=bob'));

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }));
    await user.click(screen.getByRole('option', { name: 'Email' }));
    await waitFor(() => expect(where()).toHaveTextContent('/admin/users?sort=email&q=bob'));
  });

  it('keeps the default sort and the first page out of the address', async () => {
    const user = userEvent.setup();
    api.users.mockResolvedValue(userList({ total: 60, totalPages: 3 }));
    renderPage('/admin/users?page=2');
    await screen.findByRole('table', { name: 'Users' });

    await user.click(screen.getByRole('button', { name: /page 1/i }));

    await waitFor(() => expect(where()).toHaveTextContent(/^\/admin\/users$/));
  });

  it('opens a person from anywhere on their row, remembering the list to come back to', async () => {
    const user = userEvent.setup();
    renderPage('/admin/users?sort=email&page=2');
    const row = (await screen.findByRole('link', { name: 'Ada Lovelace' })).closest('tr')!;

    await user.click(within(row).getByText('Album, Journal'));

    expect(where()).toHaveTextContent('/admin/users/u1');
    expect(where()).toHaveAttribute('data-from', '/admin/users?sort=email&page=2');
  });

  it('gives the name link the same way back', async () => {
    const user = userEvent.setup();
    renderPage('/admin/users?q=ada');

    await user.click(await screen.findByRole('link', { name: 'Ada Lovelace' }));

    expect(where()).toHaveTextContent('/admin/users/u1');
    expect(where()).toHaveAttribute('data-from', '/admin/users?q=ada');
  });

  it('spells out the assistants and keys on hover', async () => {
    const user = userEvent.setup();
    renderPage();

    const ada = (await screen.findByRole('link', { name: 'Ada Lovelace' })).closest('tr')!;
    await user.hover(within(ada).getByText('2, 1'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('2 connected assistants, 1 API key');
  });
});
