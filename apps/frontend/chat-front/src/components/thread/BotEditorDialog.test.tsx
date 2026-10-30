import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotEditorDialog, type BotEditorDialogProps } from './BotEditorDialog';
import { assistantsView, bot } from './assistantsFixtures';

const setup = (props: Partial<BotEditorDialogProps> = {}) => {
  const handlers = { onClose: vi.fn(), onCreate: vi.fn(async () => {}), onUpdate: vi.fn(async () => {}), onDelete: vi.fn(async () => {}) };
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

  it('fills the personality from a starting point, which can then be changed', async () => {
    const { onCreate } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Playful' }));
    expect(screen.getByLabelText('How it talks')).toHaveValue('Playful.');
    await userEvent.type(screen.getByLabelText('How it talks'), ' Loud.');
    await userEvent.type(screen.getByLabelText('Name'), 'Tumbi');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ personality: 'Playful. Loud.' }));
  });

  it('takes a colour and a model, and says what the model means for the allowance', async () => {
    const { onCreate } = setup();
    expect(screen.getByText('Good at several steps.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '#15803d' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Model' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Fast' }));
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
    expect(screen.getByLabelText('About Tom')).toHaveValue('Likes tea.');

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
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Starting points' })).not.toBeInTheDocument();
  });

  it('shows what a bot whose model was turned off will answer with', () => {
    setup({ bot: bot({ model: 'claude-opus-5-5' }) });
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Balanced');
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
