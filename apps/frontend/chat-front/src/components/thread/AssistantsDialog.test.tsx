import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantsDialog, type AssistantsDialogProps } from './AssistantsDialog';
import { assistantsView, bot } from './assistantsFixtures';
import type { AssistantsView } from '../../types';

const setup = (view: AssistantsView | null, props: Partial<AssistantsDialogProps> = {}) => {
  const next = view ?? assistantsView();
  const actions = {
    change: vi.fn(async () => next),
    createBot: vi.fn(async () => next),
    updateBot: vi.fn(async () => next),
    deleteBot: vi.fn(async () => next),
    setCap: vi.fn(async () => {})
  };
  const onRefresh = vi.fn();
  const onClose = vi.fn();
  render(<AssistantsDialog open onClose={onClose} view={view} onRefresh={onRefresh} actions={actions} {...props} />);
  return { actions, onRefresh, onClose };
};

describe('the dialog', () => {
  it('asks for the latest when it opens, and waits for it', () => {
    const { onRefresh } = setup(null);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('progressbar', { name: 'Loading assistants' })).toBeInTheDocument();
  });

  it('says that messages that mention an assistant go to Anthropic, where the choice is made', () => {
    setup(assistantsView());
    expect(screen.getByText(/sent to Anthropic to write the reply/)).toBeInTheDocument();
  });
});

describe('the switch', () => {
  it.each([
    [{ enabled: true }, 'On for everyone in this chat. Anyone here can turn them off.'],
    [{ enabled: false }, 'Off. Anyone in this chat can turn them on.'],
    [{ enabled: false, lockedOff: true }, 'An admin has turned assistants off for this chat.']
  ])('says where it stands for %o', (overrides, words) => {
    setup(assistantsView(overrides));
    expect(screen.getByText(words)).toBeInTheDocument();
  });

  it('is one switch for the chat, which anyone can turn on or off', async () => {
    const { actions } = setup(assistantsView({ enabled: false }));
    await userEvent.click(screen.getByRole('switch', { name: 'Allow assistants in this chat' }));
    expect(actions.change).toHaveBeenCalledWith({ enabled: true });
  });

  it('cannot be flipped while an admin has locked assistants off', () => {
    setup(assistantsView({ enabled: false, lockedOff: true }));
    expect(screen.getByRole('switch', { name: 'Allow assistants in this chat' })).toBeDisabled();
  });

  it('lets an admin turn a locked chat back on, lifting the lock with it', async () => {
    const { actions } = setup(assistantsView({ enabled: false, lockedOff: true, isManager: true }));
    await userEvent.click(screen.getByRole('switch', { name: 'Allow assistants in this chat' }));
    expect(actions.change).toHaveBeenCalledWith({ enabled: true, lockedOff: false });
  });

  it('shows what the server refused, and can be dismissed', async () => {
    const refused = Object.assign(new Error('Only the group owner or an admin can change that'), { status: 403 });
    const { actions } = setup(assistantsView(), {});
    actions.change.mockRejectedValue(refused);
    await userEvent.click(screen.getByRole('switch', { name: 'Allow assistants in this chat' }));
    expect(await screen.findByText('Only the group owner or an admin can change that')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText(/Only the group owner/)).not.toBeInTheDocument());
  });

  it('says something plain for a failure it cannot explain', async () => {
    const { actions } = setup(assistantsView());
    actions.change.mockRejectedValue(new Error('network'));
    await userEvent.click(screen.getByRole('switch', { name: 'Allow assistants in this chat' }));
    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
  });
});

describe('the assistants', () => {
  it('lists each with whose it is and which model, and marks one that is paused', () => {
    setup(
      assistantsView({
        bots: [
          bot(),
          bot({ id: 'b2', name: 'Bubu', ownerId: 'u-irja', ownerName: 'Irja', mine: false, canManage: false, modelLabel: 'Fast', paused: true })
        ]
      })
    );
    expect(screen.getByText('Tumbi')).toBeInTheDocument();
    expect(screen.getByText('Yours · Balanced')).toBeInTheDocument();
    expect(screen.getByText("Irja's · Fast")).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Ask one with @ and its name, or reply to something it said.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Tumbi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Tumbi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Bubu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Bubu' })).not.toBeInTheDocument();
  });

  it('asks before removing one, and removes it', async () => {
    const { actions } = setup(assistantsView({ bots: [bot()] }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Tumbi' }));
    expect(screen.getByText('Remove Tumbi? What it wrote stays in the chat.')).toBeInTheDocument();
    expect(actions.deleteBot).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByText(/What it wrote stays/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Tumbi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(actions.deleteBot).toHaveBeenCalledWith('b1');
    await waitFor(() => expect(screen.queryByText(/What it wrote stays/)).not.toBeInTheDocument());
  });

  it('says when there are none', () => {
    setup(assistantsView());
    expect(screen.getByText('Nobody has added one yet.')).toBeInTheDocument();
  });

  it('pauses and resumes the ones you may manage, and offers it for no one else’s', async () => {
    const { actions } = setup(
      assistantsView({ bots: [bot(), bot({ id: 'b2', name: 'Bubu', paused: true }), bot({ id: 'b3', name: 'Mochi', mine: false, canManage: false })] })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pause Tumbi' }));
    expect(actions.updateBot).toHaveBeenCalledWith('b1', { paused: true });
    await userEvent.click(screen.getByRole('button', { name: 'Resume Bubu' }));
    expect(actions.updateBot).toHaveBeenCalledWith('b2', { paused: false });
    expect(screen.queryByRole('button', { name: /Pause Mochi|Resume Mochi/ })).not.toBeInTheDocument();
  });

  it('opens one to edit, and an empty editor to add', async () => {
    setup(assistantsView({ bots: [bot()] , canAdd: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Tumbi' }));
    expect(await screen.findByRole('dialog', { name: 'Edit Tumbi' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // The editor is still closing, and holds the dialog behind it out of reach until it has.
    await userEvent.click(await screen.findByRole('button', { name: 'Add your assistant' }));
    expect(await screen.findByRole('dialog', { name: 'Add your assistant' })).toBeInTheDocument();
  });

  it('does not offer to add when you already have one', () => {
    setup(assistantsView({ canAdd: false }));
    expect(screen.queryByRole('button', { name: 'Add your assistant' })).not.toBeInTheDocument();
  });

  it('says why you cannot add when only admins may', () => {
    setup(assistantsView({ canAdd: false, whoCanAdd: 'admins', isManager: false }));
    expect(screen.getByText('Only the group owner and admins can add assistants here.')).toBeInTheDocument();
  });
});

describe('joining in unasked', () => {
  it('says which ones may, since then the recent messages go to Anthropic too', () => {
    setup(assistantsView({ bots: [bot({ joinsIn: true }), bot({ id: 'b2', name: 'Bubu', joinsIn: true, paused: true })] }));
    expect(screen.getByText(/Tumbi also joins in now and then without being asked/)).toBeInTheDocument();
    expect(screen.queryByText(/Bubu also/)).not.toBeInTheDocument();
  });

  it('says nothing of it when none does', () => {
    setup(assistantsView({ bots: [bot()] }));
    expect(screen.queryByText(/joins? in now and then/)).not.toBeInTheDocument();
  });
});

describe('what the assistants know', () => {
  it('is not here: it is in each assistant\u2019s settings', () => {
    setup(assistantsView({ memory: 'We live in Tallinn.' }));
    expect(screen.queryByLabelText('What the assistants know')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('About you both')).not.toBeInTheDocument();
  });
});

describe('for admins', () => {
  it('is for admins only', () => {
    setup(assistantsView({ isManager: false }));
    expect(screen.queryByText('For admins')).not.toBeInTheDocument();
  });

  it('lets them decide who may add one, with one on and off switch for the chat, not two', async () => {
    const { actions } = setup(assistantsView({ isManager: true }));
    expect(screen.queryByText('Turn assistants off in this chat')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Who can add assistants' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Admins only' }));
    expect(actions.change).toHaveBeenCalledWith({ whoCanAdd: 'admins' });
  });
});

describe('your allowance', () => {
  it('is in the dialog, with the cap', async () => {
    const { actions } = setup(assistantsView());
    expect(screen.getByText(/You've used 40% of this month's assistant allowance/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Stop at' }));
    await userEvent.click(await screen.findByRole('option', { name: '75% of it' }));
    expect(actions.setCap).toHaveBeenCalledWith(75);
  });
});
