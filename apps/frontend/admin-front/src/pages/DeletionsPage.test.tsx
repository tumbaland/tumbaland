import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@tumbaland/frontend-core';
import { deletionEntry, deletions } from '../test/fixtures';

const api = vi.hoisted(() => ({ deletions: vi.fn(), confirmDeletion: vi.fn(), reopenAccount: vi.fn() }));
vi.mock('../services/adminApi', () => ({ adminApi: api }));

import DeletionsPage from './DeletionsPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <DeletionsPage />
    </MemoryRouter>
  );

const card = async (email: string) => (await screen.findByRole('link', { name: email })).closest('.MuiPaper-root') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  api.deletions.mockResolvedValue(deletions());
  api.confirmDeletion.mockResolvedValue({
    id: 'd1',
    email: 'ada@example.com',
    sessionsEnded: 2,
    connectionsRevoked: 1,
    keysRevoked: 3
  });
  api.reopenAccount.mockResolvedValue(undefined);
});

describe('DeletionsPage', () => {
  it('lists the requests, with what to check before closing one', async () => {
    renderPage();

    const ada = await card('Ada Lovelace');
    expect(within(ada).getByText(/Asked .*Last here/)).toBeInTheDocument();
    expect(within(ada).getByText(/In Ada and partner \(owner, with partner@example.com\)/)).toBeInTheDocument();
    expect(within(ada).getByText(/Holds 2 albums with 42 photos, 2 journal entries and 4\.1 KB of files/)).toBeInTheDocument();
    expect(within(ada).queryByText(/Opened the app after asking/)).not.toBeInTheDocument();
  });

  it('warns when someone opened the app after asking', async () => {
    renderPage();

    const bob = await card('bob@example.com');
    expect(within(bob).getByText(/Opened the app after asking/)).toBeInTheDocument();
    expect(within(bob).getByText('In no groups.')).toBeInTheDocument();
    expect(within(bob).getByText(/Holds 1 album with 1 photo, 1 journal entry/)).toBeInTheDocument();
  });

  it('says a person alone in their group is alone', async () => {
    api.deletions.mockResolvedValue(
      deletions({ requested: [deletionEntry({ groups: [{ name: 'Solo', role: 'owner', otherMembers: [] }] })], closed: [] })
    );
    renderPage();

    expect(await screen.findByText(/In Solo \(owner, alone\)/)).toBeInTheDocument();
  });

  it('lists closed accounts as the clean-up backlog, with who closed them', async () => {
    renderPage();

    const dan = await card('dan@example.com');
    expect(within(dan).getByText(/Closed .* by admin@example.com/)).toBeInTheDocument();
    expect(within(dan).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
  });

  it('says when nobody is waiting and nothing is closed', async () => {
    api.deletions.mockResolvedValue({ requested: [], closed: [] });
    renderPage();

    expect(await screen.findByText('Nobody is waiting.')).toBeInTheDocument();
    expect(screen.getByText('No closed accounts.')).toBeInTheDocument();
  });

  describe('closing an account', () => {
    const open = async () => {
      const user = userEvent.setup();
      renderPage();
      const ada = await card('Ada Lovelace');
      await user.click(within(ada).getByRole('button', { name: 'Close account…' }));
      return { user, dialog: await screen.findByRole('dialog') };
    };

    it('says plainly what will happen before doing anything', async () => {
      const { dialog } = await open();

      expect(within(dialog).getByText('Close ada@example.com?')).toBeInTheDocument();
      expect(within(dialog).getByText(/signed out on every device and cannot sign in again/)).toBeInTheDocument();
      expect(within(dialog).getByText(/Nothing is deleted/)).toBeInTheDocument();
      expect(within(dialog).getByText(/up to an hour/)).toBeInTheDocument();
      expect(within(dialog).getByText(/groups they share keep going/)).toBeInTheDocument();
      expect(within(dialog).getByText(/reopen it from this page/)).toBeInTheDocument();
      expect(api.confirmDeletion).not.toHaveBeenCalled();
    });

    it('leaves out the group line for someone who shares none', async () => {
      const user = userEvent.setup();
      renderPage();
      const bob = await card('bob@example.com');
      await user.click(within(bob).getByRole('button', { name: 'Close account…' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByText(/groups they share/)).not.toBeInTheDocument();
    });

    it('changes nothing on cancel', async () => {
      const { user, dialog } = await open();

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.confirmDeletion).not.toHaveBeenCalled();
    });

    it('closes it, reports what was cut off, and reloads the lists', async () => {
      const { user, dialog } = await open();

      await user.click(within(dialog).getByRole('button', { name: 'Close account' }));

      expect(await screen.findByText(/Closed ada@example.com\. 2 devices signed out, 1 app and 3 keys cut off/)).toBeInTheDocument();
      expect(api.confirmDeletion).toHaveBeenCalledWith('d1');
      await waitFor(() => expect(api.deletions).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('says why it was refused, and shows the lists as they now are', async () => {
      api.confirmDeletion.mockRejectedValue(new ApiError(409, 'The request changed while you were confirming it. Look at it again.'));
      const { user, dialog } = await open();

      await user.click(within(dialog).getByRole('button', { name: 'Close account' }));

      expect(await screen.findByText(/The request changed while you were confirming it/)).toBeInTheDocument();
      await waitFor(() => expect(api.deletions).toHaveBeenCalledTimes(2));
    });

    it('can dismiss the message', async () => {
      const { user, dialog } = await open();
      await user.click(within(dialog).getByRole('button', { name: 'Close account' }));
      await screen.findByText(/Closed ada@example.com/);
      // While the dialog is leaving, the page behind it is hidden from assistive technology.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(screen.queryByText(/Closed ada@example.com/)).not.toBeInTheDocument());
    });
  });

  describe('reopening an account', () => {
    it('opens it and says so', async () => {
      const user = userEvent.setup();
      renderPage();
      const dan = await card('dan@example.com');

      await user.click(within(dan).getByRole('button', { name: 'Reopen' }));

      expect(await screen.findByText('Reopened dan@example.com. They can sign in again.')).toBeInTheDocument();
      expect(api.reopenAccount).toHaveBeenCalledWith('d3');
      await waitFor(() => expect(api.deletions).toHaveBeenCalledTimes(2));
    });

    it('says why it could not', async () => {
      api.reopenAccount.mockRejectedValue(new ApiError(409, 'This account is not closed'));
      const user = userEvent.setup();
      renderPage();
      const dan = await card('dan@example.com');

      await user.click(within(dan).getByRole('button', { name: 'Reopen' }));

      expect(await screen.findByText('This account is not closed')).toBeInTheDocument();
    });
  });
});
