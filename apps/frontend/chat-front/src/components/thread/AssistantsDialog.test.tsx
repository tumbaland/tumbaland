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
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
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

describe('what you both want them to know', () => {
  it('is saved only once it has changed', async () => {
    const { actions } = setup(assistantsView({ aboutUs: 'We live in Tallinn.' }));
    const save = screen.getAllByRole('button', { name: 'Save' })[0]!;
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('About you both'), ' Anniversary 21 October.');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(actions.change).toHaveBeenCalledWith({ aboutUs: 'We live in Tallinn. Anniversary 21 October.' });
  });
});

describe('what the assistants have noted', () => {
  it('shows the notes and saves an edit, so anyone can correct or delete one', async () => {
    const { actions } = setup(assistantsView({ memory: 'Mia is vegetarian\nTom likes tea' }));
    const notes = screen.getByLabelText('What the assistants have noted');
    expect(notes).toHaveValue('Mia is vegetarian\nTom likes tea');
    const save = screen.getAllByRole('button', { name: 'Save' })[1]!;
    expect(save).toBeDisabled();
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Mia is vegetarian');
    await userEvent.click(save);
    expect(actions.change).toHaveBeenCalledWith({ memory: 'Mia is vegetarian' });
  });

  it('keeps what someone is typing when an assistant adds a note meanwhile, and follows the server otherwise', async () => {
    const props = { open: true, onClose: vi.fn(), onRefresh: vi.fn(), actions: { change: vi.fn(), createBot: vi.fn(), updateBot: vi.fn(), deleteBot: vi.fn(), setCap: vi.fn() } };
    const { rerender } = render(<AssistantsDialog {...props} view={assistantsView({ memory: 'Mia is vegetarian', aboutUs: 'We live in Tallinn.' })} />);
    const notes = screen.getByLabelText('What the assistants have noted');
    expect(notes).toHaveValue('Mia is vegetarian');
    await userEvent.type(notes, '\nTom hates olives');
    expect(notes).toHaveValue('Mia is vegetarian\nTom hates olives');

    rerender(<AssistantsDialog {...props} view={assistantsView({ memory: 'Mia is vegetarian\nTom likes tea', aboutUs: 'We live in Oslo.' })} />);

    expect(notes).toHaveValue('Mia is vegetarian\nTom hates olives');
    // Not being edited, so it follows.
    expect(screen.getByLabelText('About you both')).toHaveValue('We live in Oslo.');
  });

  it('lets people stop the assistants adding notes', async () => {
    const { actions } = setup(assistantsView({ memoryOn: true }));
    await userEvent.click(screen.getByRole('switch', { name: 'Let assistants add notes' }));
    expect(actions.change).toHaveBeenCalledWith({ memoryOn: false });
  });
});

describe('for admins', () => {
  it('is for admins only', () => {
    setup(assistantsView({ isManager: false }));
    expect(screen.queryByText('For admins')).not.toBeInTheDocument();
  });

  it('lets them turn assistants off for the chat and decide who may add one', async () => {
    const { actions } = setup(assistantsView({ isManager: true }));
    await userEvent.click(screen.getByRole('switch', { name: 'Turn assistants off in this chat' }));
    expect(actions.change).toHaveBeenCalledWith({ lockedOff: true });

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
