import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@tumbaland/frontend-core';
import { userDetail } from '../test/fixtures';

const api = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('../services/adminApi', () => ({ adminApi: api }));

import UserDetailPage from './UserDetailPage';

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/users/u1', state }]}>
      <Routes>
        <Route path="/admin/users/:id" element={<UserDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.user.mockResolvedValue(userDetail());
});

describe('UserDetailPage', () => {
  it('asks for the person in the address', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(api.user).toHaveBeenCalledWith('u1');
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All users/ })).toHaveAttribute('href', '/admin/users');
  });

  it('goes back to the list as it was left, when it was the way in', async () => {
    renderPage({ from: '/admin/users?sort=email&page=2' });

    expect(await screen.findByRole('link', { name: /All users/ })).toHaveAttribute('href', '/admin/users?sort=email&page=2');
  });

  it('uses the email as the title for someone with no name', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({ ...detail, user: { ...detail.user, name: null } });
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'ada@example.com' })).toBeInTheDocument();
  });

  it('shows the days they were here, with where from', async () => {
    renderPage();

    expect(await screen.findByRole('group', { name: /Days active/ })).toBeInTheDocument();
    expect(screen.getByText('Days here').closest('div')).toHaveTextContent('4');
    expect(screen.getByText('Browser · 1')).toBeInTheDocument();
    expect(screen.getByText('Installed app · 3')).toBeInTheDocument();
    expect(screen.getByText(/Estonia · 1 day$/)).toBeInTheDocument();
    expect(screen.getByText(/Finland · 1 day$/)).toBeInTheDocument();
  });

  it('shows what they open and what they did, by the names people use', async () => {
    renderPage();

    const opened = await screen.findByRole('table', { name: 'Pages opened' });
    expect(within(opened).getByText('Album')).toBeInTheDocument();
    expect(within(opened).getByText('Journal')).toBeInTheDocument();
    const did = screen.getByRole('table', { name: 'What they did' });
    const photo = within(did).getByText('photo').closest('tr')!;
    expect(within(photo).getByText('Album')).toBeInTheDocument();
    expect(within(photo).getByText('added')).toBeInTheDocument();
    expect(within(photo).getByText('12')).toBeInTheDocument();
  });

  it('says nothing is counted for someone who has done nothing', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({ ...detail, modules: { opens: [], writes: [] } });
    renderPage();

    expect(await screen.findByText('Nothing counted yet.')).toBeInTheDocument();
  });

  it('shows their quota against the plan, and what someone else pays for', async () => {
    renderPage();

    expect(await screen.findByText(/Plan: free/)).toBeInTheDocument();
    expect(screen.getByText('500 MB of 1 GB')).toBeInTheDocument();
    expect(screen.getByText('Not counted yet (limit 25)')).toBeInTheDocument();
    expect(screen.getByText('AI analyses (2026-10)')).toBeInTheDocument();
    expect(screen.getByText('1 of No limit')).toBeInTheDocument();

    expect(screen.getByText('Paid for by bob@example.com')).toBeInTheDocument();
    expect(screen.getByText(/In Ada and Bob/)).toBeInTheDocument();
    expect(screen.getByText(/The plan could not be looked up/)).toBeInTheDocument();
  });

  it('lists connected assistants, keys and devices without secrets', async () => {
    renderPage();

    const assistants = await screen.findByRole('table', { name: 'Connected assistants' });
    expect(within(assistants).getByText('Claude')).toBeInTheDocument();
    expect(within(assistants).getByText('relationship:read')).toBeInTheDocument();

    const keys = screen.getByRole('table', { name: 'API keys' });
    const script = within(keys).getByText('Script').closest('tr')!;
    expect(within(script).getByText('active')).toBeInTheDocument();
    // Never used, and never expires.
    expect(within(script).getAllByText('Never')).toHaveLength(2);
    const old = within(keys).getByText('Old').closest('tr')!;
    expect(within(old).getByText('revoked')).toBeInTheDocument();
    expect(within(old).getByText('-')).toBeInTheDocument();

    const devices = screen.getByRole('table', { name: 'Devices' });
    expect(within(devices).getByText('Safari on iOS')).toBeInTheDocument();
  });

  it('says when nothing is connected', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({ ...detail, apps: { connections: [], keys: [], devices: [] } });
    renderPage();

    expect(await screen.findByText('No assistant is connected.')).toBeInTheDocument();
    expect(screen.getByText('No keys.')).toBeInTheDocument();
    expect(screen.getByText('No device is signed in.')).toBeInTheDocument();
  });

  it('shows what assistants did for them, and the cost', async () => {
    renderPage();

    expect(await screen.findByRole('group', { name: 'Assistant calls each day' })).toBeInTheDocument();
    const clients = screen.getByRole('table', { name: 'Assistants' });
    expect(within(clients).getByText('Claude')).toBeInTheDocument();
    expect(within(clients).getByText('200 ms')).toBeInTheDocument();
    const tools = screen.getByRole('table', { name: 'Tools' });
    expect(within(tools).getByText('log_day')).toBeInTheDocument();
    expect(
      screen.getByText(/a key read Journal 2 times; an assistant added to Album 1 time/)
    ).toBeInTheDocument();
  });

  it('says when no assistant did anything', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({ ...detail, assistants: { ...detail.assistants, clients: [], tools: [], elsewhere: [] } });
    renderPage();

    expect(await screen.findByText(/No assistant has done anything for this account/)).toBeInTheDocument();
  });

  it('flags an administrator, a request and a closed account, each linking to the queue', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({
      ...detail,
      user: {
        ...detail.user,
        roles: ['admin'],
        deletion: { state: 'requested', requestedAt: '2026-10-20T10:00:00.000Z', confirmedAt: null, confirmedBy: null }
      }
    });
    renderPage();

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asked to be deleted/ })).toHaveAttribute('href', '/admin/deletions');
  });

  it('flags a closed account', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({
      ...detail,
      user: {
        ...detail.user,
        deletion: {
          state: 'closed',
          requestedAt: '2026-10-20T10:00:00.000Z',
          confirmedAt: '2026-10-22T10:00:00.000Z',
          confirmedBy: 'a1'
        }
      }
    });
    renderPage();

    expect(await screen.findByRole('link', { name: /^Closed / })).toHaveAttribute('href', '/admin/deletions');
  });

  it('says so when the person does not exist', async () => {
    api.user.mockRejectedValue(new ApiError(404, 'User not found'));
    renderPage();

    expect(await screen.findByText('That does not exist.')).toBeInTheDocument();
  });

  it('shows no country or device chips for someone who has never been counted', async () => {
    const detail = userDetail();
    api.user.mockResolvedValue({
      ...detail,
      visits: { ...detail.visits, days: [], totalActiveDays: 0, firstActiveDay: null, platforms: {}, countries: {} }
    });
    renderPage();

    expect(await screen.findByText('Never', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText(/Browser/)).not.toBeInTheDocument();
  });
});
