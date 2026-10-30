import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@tumbaland/frontend-core';
import { claudeKey, overview } from '../test/fixtures';

const api = vi.hoisted(() => ({ overview: vi.fn(), claudeKey: vi.fn() }));
vi.mock('../services/adminApi', () => ({ adminApi: api }));

import OverviewPage from './OverviewPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.overview.mockResolvedValue(overview());
  api.claudeKey.mockResolvedValue(claudeKey());
});

describe('OverviewPage', () => {
  it('opens with how many people were here', async () => {
    renderPage();

    expect(await screen.findByText('Here today')).toBeInTheDocument();
    expect(api.overview).toHaveBeenCalledWith(30);
    const tile = (label: string) => screen.getByText(label).closest('div')!;
    expect(within(tile('Here today')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Last 7 days')).getByText('3')).toBeInTheDocument();
    expect(within(tile('Last 30 days')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Accounts')).getByText('4')).toBeInTheDocument();
  });

  it('shows the pairs, the assistants and the market-data budget', async () => {
    renderPage();

    const pairs = (await screen.findByText('Pairs both here')).closest('div')!;
    expect(within(pairs).getByText('1 of 2')).toBeInTheDocument();
    const assistants = screen.getByText('Assistant calls').closest('div')!;
    expect(within(assistants).getByText('120')).toBeInTheDocument();
    expect(within(assistants).getByText(/45,000 tokens|45\.000 tokens|45000 tokens/)).toBeInTheDocument();
    const market = screen.getByText('Market data').closest('div')!;
    expect(within(market).getByText('7 of 25')).toBeInTheDocument();
  });

  it('links to the deletion requests when there are some', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Review them' })).toHaveAttribute('href', '/admin/deletions');
  });

  it('says none are waiting when none are', async () => {
    api.overview.mockResolvedValue(overview({ accounts: { total: 4, pendingDeletions: 0 } }));
    renderPage();

    expect(await screen.findByText('none waiting')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review them' })).not.toBeInTheDocument();
  });

  it('charts people each day and new accounts each week', async () => {
    renderPage();

    expect(await screen.findByRole('group', { name: 'People here each day' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'New accounts each week' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /: 3 people$/ })).toBeInTheDocument();
  });

  it('warns when some days were filled in rather than counted', async () => {
    api.overview.mockResolvedValue(overview({ includesBackfilled: true }));
    renderPage();

    expect(await screen.findByText(/filled in from what people wrote/)).toBeInTheDocument();
  });

  it('shows who came back, with a dash for a week that has not happened', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Who came back after signing up' });
    const rows = within(table).getAllByRole('row');
    // Header, then the two cohorts.
    expect(rows).toHaveLength(3);
    // One of the two came back in weeks 1, 2 and 4; week 8 has not started.
    expect(within(rows[1]).getAllByText('1 (50%)')).toHaveLength(3);
    expect(within(rows[1]).getAllByLabelText('not reached yet')).toHaveLength(1);
    expect(within(rows[2]).getAllByLabelText('not reached yet')).toHaveLength(4);
  });

  it('says there is nobody to follow when nobody signed up', async () => {
    api.overview.mockResolvedValue(overview({ cohorts: [] }));
    renderPage();

    expect(await screen.findByText(/Nobody has signed up in the last eight weeks/)).toBeInTheDocument();
  });

  it('lists the parts of the app by the names people know, most used first', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Pages opened each week' });
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['Album', 'Chat', 'Journal']);
  });

  it('says nothing is counted yet before any page was opened', async () => {
    api.overview.mockResolvedValue(overview({ opensByWeek: [] }));
    renderPage();

    expect(await screen.findByText(/Nothing counted yet/)).toBeInTheDocument();
  });

  it('loads another period when asked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Here today');

    await user.click(screen.getByRole('button', { name: '90 days' }));

    await waitFor(() => expect(api.overview).toHaveBeenLastCalledWith(90));
    await user.click(screen.getByRole('button', { name: 'A year' }));
    await waitFor(() => expect(api.overview).toHaveBeenLastCalledWith(365));
  });

  it('keeps the period when the selected one is clicked again', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Here today');

    await user.click(screen.getByRole('button', { name: '30 days' }));

    expect(api.overview).toHaveBeenCalledTimes(1);
  });

  it('says so, and offers another try, when it cannot load', async () => {
    api.overview.mockRejectedValueOnce(new ApiError(403, 'admin required')).mockResolvedValueOnce(overview());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('This area is for administrators.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Here today')).toBeInTheDocument();
  });
});

describe('the assistants\u2019 key on the Overview', () => {
  it('says nothing when it is fine', async () => {
    renderPage();
    await screen.findByText('Here today');
    expect(screen.queryByText(/the chat assistants use/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no longer accepting/)).not.toBeInTheDocument();
  });

  it('says so when Anthropic has stopped accepting it, with a way to the page', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ status: 'rejected' }));
    renderPage();
    expect(await screen.findByText(/no longer accepting the key the chat assistants use/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', expect.stringMatching(/\/claude$/));
  });

  it.each([
    [12, 'The key the chat assistants use expires in 12 days.'],
    [1, 'The key the chat assistants use expires in 1 day.'],
    [0, 'The key the chat assistants use expires today.'],
    [-3, 'The key the chat assistants use is past its expiry date.']
  ])('warns when it is close to its date (%i days)', async (daysLeft, words) => {
    api.claudeKey.mockResolvedValue(claudeKey({ expiringSoon: true, daysLeft }));
    renderPage();
    expect(await screen.findByText(words)).toBeInTheDocument();
  });

  it('says nothing when there is no key, or when chat could not be asked', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ configured: false }));
    const { unmount } = renderPage();
    await screen.findByText('Here today');
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();
    unmount();

    api.claudeKey.mockRejectedValue(new ApiError(500, 'down'));
    renderPage();
    await screen.findByText('Here today');
    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();
  });
});
