import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@tumbaland/frontend-core';
import { claudeKey, claudeUsage } from '../test/fixtures';

const api = vi.hoisted(() => ({
  claudeKey: vi.fn(),
  saveClaudeKey: vi.fn(),
  removeClaudeKey: vi.fn(),
  checkClaudeKey: vi.fn(),
  claudeUsage: vi.fn(),
  setAllowance: vi.fn()
}));
vi.mock('../services/adminApi', () => ({ adminApi: api, UNITS_PER_DOLLAR: 10_000 }));

import ClaudePage from './ClaudePage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ClaudePage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.claudeKey.mockResolvedValue(claudeKey());
  api.claudeUsage.mockResolvedValue(claudeUsage());
  api.saveClaudeKey.mockResolvedValue(claudeKey());
  api.removeClaudeKey.mockResolvedValue(claudeKey({ configured: false, last4: null, status: null }));
  api.setAllowance.mockResolvedValue(undefined);
});

describe('the key', () => {
  it('shows only its last four characters, who set it, and when it expires', async () => {
    renderPage();
    expect(await screen.findByText(/sk-ant-…WXYZ/)).toBeInTheDocument();
    expect(screen.getByText(/set by Ada/)).toBeInTheDocument();
    expect(screen.getByText(/Expires in 120 days/)).toBeInTheDocument();
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('is written once and cleared from the box, with the expiry date kept alongside', async () => {
    renderPage();
    await screen.findByText(/sk-ant-…WXYZ/);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Replace the key'), '  sk-ant-api03-new-key-0000  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.saveClaudeKey).toHaveBeenCalledWith({ apiKey: 'sk-ant-api03-new-key-0000', expiresOn: '2027-03-01' });
    await waitFor(() => expect(screen.getByLabelText('Replace the key')).toHaveValue(''));
  });

  it('saves a new date without touching the key', async () => {
    renderPage();
    await screen.findByText(/sk-ant-…WXYZ/);
    const date = screen.getByLabelText('Expires on');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-06-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.saveClaudeKey).toHaveBeenCalledWith({ expiresOn: '2027-06-01' });
  });

  it('shows what Anthropic or the server said when it is refused', async () => {
    api.saveClaudeKey.mockRejectedValue(new ApiError(400, 'Anthropic did not accept that key'));
    renderPage();
    await screen.findByText(/sk-ant-…WXYZ/);
    await userEvent.type(screen.getByLabelText('Replace the key'), 'sk-ant-api03-nope-0000000000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Anthropic did not accept that key')).toBeInTheDocument();
  });

  it('asks before removing it', async () => {
    renderPage();
    await screen.findByText(/sk-ant-…WXYZ/);
    await userEvent.click(screen.getByRole('button', { name: 'Remove the key' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(api.removeClaudeKey).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove the key' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(api.removeClaudeKey).toHaveBeenCalled();
  });

  it('starts empty when none is saved', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ configured: false, last4: null, status: null, expiresOn: null, daysLeft: null }));
    renderPage();
    expect(await screen.findByText('Not set')).toBeInTheDocument();
    expect(screen.getByLabelText('API key', { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove the key' })).not.toBeInTheDocument();
    expect(screen.getByText('Save a key first.')).toBeInTheDocument();
  });

  it('checks the saved key again, and says what Anthropic answered', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ status: 'rejected', rejectedReason: 'Anthropic answered 401' }));
    api.checkClaudeKey.mockRejectedValueOnce(new ApiError(400, 'Anthropic did not accept that key'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Anthropic did not accept that key')).toBeInTheDocument();

    api.checkClaudeKey.mockResolvedValueOnce(claudeKey());
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(api.claudeKey).toHaveBeenCalledTimes(2));
  });

  it('says when Anthropic has stopped accepting it', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ status: 'rejected', rejectedReason: 'Anthropic answered 401' }));
    renderPage();
    expect(await screen.findByText('Rejected by Anthropic')).toBeInTheDocument();
    expect(screen.getByText(/Anthropic is not accepting this key \(Anthropic answered 401\)/)).toBeInTheDocument();
  });

  it.each([
    [10, 'Expires in 10 days.'],
    [1, 'Expires in 1 day.'],
    [0, 'Expires today.'],
    [-1, 'Expired 1 day ago.'],
    [-4, 'Expired 4 days ago.']
  ])('warns as the date comes (%i days)', async (daysLeft, words) => {
    api.claudeKey.mockResolvedValue(claudeKey({ expiringSoon: true, daysLeft }));
    renderPage();
    expect(await screen.findByText(new RegExp(words.replace('.', '\\.')))).toBeInTheDocument();
  });

  it('says when the server has nothing to seal a key with, and will not take one', async () => {
    api.claudeKey.mockResolvedValue(claudeKey({ configured: false, encryptionReady: false, last4: null, status: null }));
    renderPage();
    expect(await screen.findByText(/no API_KEY_ENCRYPTION_SECRET/)).toBeInTheDocument();
    expect(screen.getByLabelText('API key', { selector: 'input' })).toBeDisabled();
  });
});

describe('the models', () => {
  it('lists each with its price and how many assistants use it', async () => {
    renderPage();
    expect(await screen.findByText('Fast (Haiku)')).toBeInTheDocument();
    expect(screen.getByText(/\$2 in, \$10 out per million tokens · 2 assistants/)).toBeInTheDocument();
    expect(screen.getByText(/\$4 in, \$20 out per million tokens · 1 assistant$/)).toBeInTheDocument();
  });

  it('turns one off and says how many assistants it moves to the default', async () => {
    renderPage();
    await screen.findByText('Fast (Haiku)');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Best (Opus)' }));
    expect(screen.getByText('1 using Opus will answer with Sonnet instead.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save models' }));
    expect(api.saveClaudeKey).toHaveBeenCalledWith({
      models: { enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5'], default: 'claude-sonnet-5-5' }
    });
  });

  it('moves the default when the default is turned off, and picks another', async () => {
    renderPage();
    await screen.findByText('Fast (Haiku)');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Balanced (Sonnet)' }));
    expect(screen.getByRole('radio', { name: 'Haiku is the default' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Balanced (Sonnet)' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Opus is the default' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save models' }));
    expect(api.saveClaudeKey).toHaveBeenCalledWith({
      models: { enabled: ['claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5'], default: 'claude-opus-5-5' }
    });
  });

  it('will not save with none left on, or with nothing changed', async () => {
    renderPage();
    await screen.findByText('Fast (Haiku)');
    expect(screen.getByRole('button', { name: 'Save models' })).toBeDisabled();
    for (const name of ['Fast (Haiku)', 'Balanced (Sonnet)', 'Best (Opus)']) {
      await userEvent.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.getByRole('button', { name: 'Save models' })).toBeDisabled();
  });

  it('shows what the server refused', async () => {
    api.saveClaudeKey.mockRejectedValue(new ApiError(400, 'Keep at least one model turned on'));
    renderPage();
    await screen.findByText('Fast (Haiku)');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Best (Opus)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save models' }));
    expect(await screen.findByText('Keep at least one model turned on')).toBeInTheDocument();
  });
});

describe('use', () => {
  it('adds up the month, by person, model and chat, in dollars', async () => {
    renderPage();
    const tile = (await screen.findByText(/, everyone$/)).parentElement!;
    expect(within(tile).getByText('$0.54')).toBeInTheDocument();
    expect(api.claudeUsage).toHaveBeenCalledWith(new Date().toISOString().slice(0, 7));

    const people = within(screen.getByRole('table', { name: 'Use by person' }));
    expect(people.getByText('tom@example.com')).toBeInTheDocument();
    expect(people.getByText('96% of $0.50')).toBeInTheDocument();
    expect(people.getByText('No limit')).toBeInTheDocument();
    const models = within(screen.getByRole('table', { name: 'Use by model' }));
    expect(models.getByText('Opus')).toBeInTheDocument();
    expect(models.getByText('$0.40')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Use by chat' })).getByText('c1')).toBeInTheDocument();
  });

  it('marks someone who has used it up', async () => {
    api.claudeUsage.mockResolvedValue(
      claudeUsage({ byPerson: [{ email: 'tom@example.com', replies: 9, units: 5200, limit: 5000, percent: 104, exhausted: true }] })
    );
    renderPage();
    expect(await screen.findByText('104% of $0.50, used up')).toBeInTheDocument();
  });

  it('says so for a month nobody used it', async () => {
    api.claudeUsage.mockResolvedValue(claudeUsage({ totals: { replies: 0, failed: 0, units: 0 }, byPerson: [], byModel: [], byChat: [] }));
    renderPage();
    expect(await screen.findByText('No assistant has answered anyone this month.')).toBeInTheDocument();
  });

  it('goes back a month and forward again, never past this one', async () => {
    renderPage();
    await screen.findByText(/, everyone$/);
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const now = new Date();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    await waitFor(() => expect(api.claudeUsage).toHaveBeenLastCalledWith(previous));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(api.claudeUsage).toHaveBeenLastCalledWith(now.toISOString().slice(0, 7)));
  });

  it('shows a cost under a cent in four places, not as zero', async () => {
    api.claudeUsage.mockResolvedValue(claudeUsage({ totals: { replies: 1, failed: 0, units: 20 } }));
    renderPage();
    expect(await screen.findByText('$0.0020')).toBeInTheDocument();
  });
});

describe('changing one person’s allowance', () => {
  const open = async () => {
    renderPage();
    await screen.findByText(/, everyone$/);
    await userEvent.click(screen.getByRole('button', { name: 'Change the allowance for tom@example.com' }));
    return within(await screen.findByRole('dialog', { name: 'Change the allowance' }));
  };

  it('needs a reason and an amount, and saves it in units', async () => {
    const dialog = await open();
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.type(dialog.getByLabelText('Dollars a month'), '2.5');
    await userEvent.type(dialog.getByLabelText('Why'), 'Helping with the trip');
    await userEvent.type(dialog.getByLabelText('Until'), '2026-12-01');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));

    expect(api.setAllowance).toHaveBeenCalledWith('tom@example.com', 25_000, 'Helping with the trip', '2026-12-01');
    await waitFor(() => expect(api.claudeUsage).toHaveBeenCalledTimes(2));
  });

  it('can take the limit off', async () => {
    const dialog = await open();
    await userEvent.click(dialog.getByRole('checkbox', { name: 'No limit' }));
    expect(dialog.getByLabelText('Dollars a month')).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Why'), 'Family');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(api.setAllowance).toHaveBeenCalledWith('tom@example.com', -1, 'Family', undefined);
  });

  it('shows what went wrong and stays open', async () => {
    api.setAllowance.mockRejectedValue(new ApiError(500, 'Could not reach payments'));
    const dialog = await open();
    await userEvent.type(dialog.getByLabelText('Dollars a month'), '1');
    await userEvent.type(dialog.getByLabelText('Why'), 'x');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Could not reach payments')).toBeInTheDocument();
  });

  it('closes without saving', async () => {
    const dialog = await open();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(api.setAllowance).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Change the allowance' })).not.toBeInTheDocument());
  });
});

describe('when chat cannot be reached', () => {
  it('says so', async () => {
    api.claudeKey.mockRejectedValue(new ApiError(502, 'Bad gateway'));
    renderPage();
    expect(await screen.findByText('Bad gateway')).toBeInTheDocument();
  });
});
