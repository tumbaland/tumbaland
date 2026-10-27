import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { assistants } from '../test/fixtures';

const api = vi.hoisted(() => ({ assistants: vi.fn() }));
vi.mock('../services/adminApi', () => ({ adminApi: api }));

import AssistantsPage from './AssistantsPage';

beforeEach(() => {
  vi.clearAllMocks();
  api.assistants.mockResolvedValue(assistants());
});

describe('AssistantsPage', () => {
  it('totals what assistants did', async () => {
    render(<AssistantsPage />);

    const calls = (await screen.findByText('Calls', { selector: 'p' })).closest('div')!;
    expect(within(calls).getByText('4')).toBeInTheDocument();
    expect(within(screen.getByText('Failed', { selector: 'p' }).closest('div')!).getByText('25%')).toBeInTheDocument();
    expect(api.assistants).toHaveBeenCalledWith(30);
  });

  it('lists each app with its accounts and calls, including one that has done nothing', async () => {
    render(<AssistantsPage />);

    const table = await screen.findByRole('table', { name: 'Assistant apps' });
    const claude = within(table).getByText('Claude').closest('tr')!;
    expect(within(claude).getAllByText('2')).toHaveLength(2); // connected and at work
    expect(within(claude).getByText('1,100')).toBeInTheDocument();
    const quiet = within(table).getByText('Quiet App').closest('tr')!;
    expect(within(quiet).getByText('Never')).toBeInTheDocument();
  });

  it('ranks tools by tokens, with the failure rate', async () => {
    render(<AssistantsPage />);

    const table = await screen.findByRole('table', { name: 'Assistant tools' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('log_day')).toBeInTheDocument();
    expect(within(rows[1]).getByText('get_day')).toBeInTheDocument();
    expect(within(rows[1]).getByText('1 (33%)')).toBeInTheDocument();
    expect(within(rows[1]).getByText('83')).toBeInTheDocument();
  });

  it('says how many keys are in use, with the right grammar', async () => {
    render(<AssistantsPage />);
    expect(await screen.findByText(/1 API key is in use, and keys did 2 things in these 30 days/)).toBeInTheDocument();
  });

  it('uses the singular and plural forms for keys', async () => {
    api.assistants.mockResolvedValue(assistants({ keys: { live: 3, actionsInWindow: 1 } }));
    render(<AssistantsPage />);
    expect(await screen.findByText(/3 API keys are in use, and keys did 1 thing/)).toBeInTheDocument();
  });

  it('says so when nothing has happened', async () => {
    api.assistants.mockResolvedValue(
      assistants({ totals: { calls: 0, failed: 0, tokens: 0, accounts: 0 }, clients: [], tools: [] })
    );
    render(<AssistantsPage />);

    expect(await screen.findByText('No assistant has connected yet.')).toBeInTheDocument();
    expect(screen.getByText('No tool has been called in this time.')).toBeInTheDocument();
    expect(within(screen.getByText('Failed', { selector: 'p' }).closest('div')!).getByText('-')).toBeInTheDocument();
  });

  it('loads another period when asked', async () => {
    const user = userEvent.setup();
    render(<AssistantsPage />);
    await screen.findByText('Assistant apps', { selector: 'h2' }).catch(() => undefined);
    await screen.findByRole('table', { name: 'Assistant apps' });

    await user.click(screen.getByRole('button', { name: '90 days' }));
    await waitFor(() => expect(api.assistants).toHaveBeenLastCalledWith(90));

    await user.click(screen.getByRole('button', { name: 'A year' }));
    await waitFor(() => expect(api.assistants).toHaveBeenLastCalledWith(365));

    await user.click(screen.getByRole('button', { name: 'A year' }));
    expect(api.assistants).toHaveBeenCalledTimes(3);
  });
});
