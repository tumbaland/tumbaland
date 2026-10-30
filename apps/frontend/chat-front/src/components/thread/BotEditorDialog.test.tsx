import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotEditorDialog, type BotEditorDialogProps } from './BotEditorDialog';
import { assistantsView, bot } from './assistantsFixtures';

const setup = (props: Partial<BotEditorDialogProps> = {}) => {
  const handlers = {
    onClose: vi.fn(),
    onCreate: vi.fn(async () => {}),
    onUpdate: vi.fn(async () => {}),
    onDelete: vi.fn(async () => {}),
    onChangeSettings: vi.fn(async () => {})
  };
  render(<BotEditorDialog open bot={null} view={assistantsView()} {...handlers} {...props} />);
  return handlers;
};

describe('adding an assistant', () => {
  it('needs a name, and offers the next free colour and the default model', async () => {
    const { onCreate, onClose } = setup({ view: assistantsView({ bots: [bot({ color: '#7c3aed' })] }) });

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), '  Bubu ');
    expect(screen.getByText('You will type @Bubu to ask it something.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onCreate).toHaveBeenCalledWith({ name: 'Bubu', personality: '', aboutOwner: '', color: '#0369a1', model: 'claude-sonnet-5-5' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('takes how it talks and what it should know about you as written, with no ready-made styles', async () => {
    const { onCreate, onChangeSettings } = setup();
    expect(screen.queryByRole('button', { name: 'Playful' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('How it talks'), 'Loud.');
    await userEvent.type(screen.getByLabelText('About you'), 'Likes tea.');
    await userEvent.type(screen.getByLabelText('Name'), 'Tumbi');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ personality: 'Loud.', aboutOwner: 'Likes tea.' }));
    // Nothing of the chat's was touched, so nothing of it is saved.
    expect(onChangeSettings).not.toHaveBeenCalled();
  });

  it('takes a colour and a model, and says what the model means for the allowance', async () => {
    const { onCreate } = setup();
    expect(screen.getByText('Good at several steps.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '#15803d' }));
    expect(screen.getByRole('radiogroup', { name: 'Model' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Fast' }));
    expect(screen.getByText('Quick and light.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'Tumbi');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ color: '#15803d', model: 'claude-haiku-5-5' }));
  });

  it('shows what the server refused, in its own words, and stays open', async () => {
    const taken = Object.assign(new Error('There is already an assistant called Tumbi here'), { status: 400 });
    const { onClose } = setup({ onCreate: vi.fn().mockRejectedValue(taken) });
    await userEvent.type(screen.getByLabelText('Name'), 'Tumbi');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('There is already an assistant called Tumbi here')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says something plain for a failure it cannot explain', async () => {
    setup({ onCreate: vi.fn().mockRejectedValue(new Error('network')) });
    await userEvent.type(screen.getByLabelText('Name'), 'Tumbi');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
  });
});

describe('changing an assistant', () => {
  it('starts from what it has, and saves the change', async () => {
    const { onUpdate, onClose } = setup({ bot: bot() });
    expect(screen.getByRole('dialog', { name: 'Edit Tumbi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Tumbi');
    expect(screen.getByLabelText('How it talks')).toHaveValue('Cheeky.');
    expect(screen.getByLabelText('About you')).toHaveValue('Likes tea.');
    expect(screen.getByText('Only you can see this. It is used only when you ask, and never repeated in the chat.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Mochi');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith('b1', expect.objectContaining({ name: 'Mochi', personality: 'Cheeky.' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('asks before removing, and removes', async () => {
    const { onDelete, onClose } = setup({ bot: bot() });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove Tumbi? What it wrote stays in the chat.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(onDelete).toHaveBeenCalledWith('b1');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('says why when it could not be removed, and goes back to asking', async () => {
    const refused = Object.assign(new Error('Only the owner of this assistant, or a group admin, can change it'), { status: 403 });
    setup({ bot: bot(), onDelete: vi.fn().mockRejectedValue(refused) });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(await screen.findByText(/Only the owner of this assistant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('lets anyone read someone else’s, and change nothing', async () => {
    setup({ bot: bot({ mine: false, canManage: false, ownerName: 'Irja' }) });
    expect(screen.getByRole('dialog', { name: 'Tumbi' })).toBeInTheDocument();
    expect(screen.getByText(/Irja made this assistant/)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByLabelText('How it talks')).toBeDisabled();
    expect(screen.queryByLabelText('About you')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('still lets them change what every assistant knows about the chat, and saves only that', async () => {
    const { onChangeSettings, onUpdate } = setup({ bot: bot({ mine: false, canManage: false, ownerName: 'Irja' }), view: assistantsView({ memory: 'We live in Tallinn.' }) });
    const known = screen.getByLabelText('About everyone in this chat');
    expect(known).toBeEnabled();
    await userEvent.type(known, '\nIrja is vegetarian.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChangeSettings).toHaveBeenCalledWith({ memory: 'We live in Tallinn.\nIrja is vegetarian.' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('lets an admin change someone else\u2019s, without seeing or sending what they said about themselves', async () => {
    const { onUpdate } = setup({ bot: bot({ mine: false, canManage: true, ownerName: 'Irja', aboutOwner: '' }) });
    expect(screen.queryByLabelText('About you')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith('b1', expect.not.objectContaining({ aboutOwner: expect.anything() }));
  });

  it('shows what a bot whose model was turned off will answer with', () => {
    setup({ bot: bot({ model: 'claude-opus-5-5' }) });
    expect(screen.getByRole('radio', { name: 'Balanced' })).toBeChecked();
  });

  it('lets it join in now and then, says what that sends and whose allowance it uses, and saves it', async () => {
    const { onUpdate } = setup({ bot: bot() });
    expect(screen.getByText(/at most once every two hours/)).toHaveTextContent('it uses your allowance');
    await userEvent.click(screen.getByRole('switch', { name: 'Joins in now and then' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith('b1', expect.objectContaining({ joinsIn: true }));
  });

  it('names the owner whose allowance someone else\u2019s would use, and cannot be switched by others', () => {
    setup({ bot: bot({ mine: false, canManage: false, ownerName: 'Irja', joinsIn: true }) });
    expect(screen.getByText(/at most once every two hours/)).toHaveTextContent("Irja's allowance");
    expect(screen.getByRole('switch', { name: 'Joins in now and then' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Joins in now and then' })).toBeDisabled();
  });

  it('is not offered until it exists', () => {
    setup();
    expect(screen.queryByRole('switch', { name: 'Joins in now and then' })).not.toBeInTheDocument();
  });

  it('has no pause of its own: that is the button in the Assistants list', () => {
    setup({ bot: bot() });
    expect(screen.queryByRole('switch', { name: /Paused/ })).not.toBeInTheDocument();
  });

  it('saves what the chat knows and whether assistants may add to it, along with the assistant', async () => {
    const { onChangeSettings, onUpdate } = setup({ bot: bot(), view: assistantsView({ memory: 'Mia is vegetarian\nTom likes tea', memoryOn: true }) });
    const known = screen.getByLabelText('About everyone in this chat');
    expect(known).toHaveValue('Mia is vegetarian\nTom likes tea');
    await userEvent.clear(known);
    await userEvent.type(known, 'Mia is vegetarian');
    await userEvent.click(screen.getByRole('switch', { name: 'Let assistants add a line when asked to remember something' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChangeSettings).toHaveBeenCalledWith({ memory: 'Mia is vegetarian', memoryOn: false });
    expect(onUpdate).toHaveBeenCalled();
  });

  it('follows the server until someone types, then keeps what they typed when an assistant adds a line', async () => {
    const handlers = { onClose: vi.fn(), onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), onChangeSettings: vi.fn() };
    const { rerender } = render(<BotEditorDialog open bot={bot()} view={assistantsView({ memory: 'Mia is vegetarian' })} {...handlers} />);
    const known = screen.getByLabelText('About everyone in this chat');

    rerender(<BotEditorDialog open bot={bot()} view={assistantsView({ memory: 'Mia is vegetarian\nWe live in Oslo.' })} {...handlers} />);
    expect(known).toHaveValue('Mia is vegetarian\nWe live in Oslo.');

    await userEvent.type(known, '\nTom hates olives');
    rerender(<BotEditorDialog open bot={bot()} view={assistantsView({ memory: 'Mia is vegetarian\nWe live in Oslo.\nTom likes tea' })} {...handlers} />);
    expect(known).toHaveValue('Mia is vegetarian\nWe live in Oslo.\nTom hates olives');
  });

  it('leads on to the chat-wide settings when given the way', async () => {
    const onOpenSettings = vi.fn();
    setup({ bot: bot(), onOpenSettings });
    await userEvent.click(screen.getByRole('button', { name: 'Settings for all assistants in this chat' }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('has no such link from the Assistants list', () => {
    setup({ bot: bot() });
    expect(screen.queryByRole('button', { name: 'Settings for all assistants in this chat' })).not.toBeInTheDocument();
  });

  it('does not close while a save is in flight', async () => {
    let finish: () => void = () => {};
    const { onClose } = setup({ bot: bot(), onUpdate: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))) });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
