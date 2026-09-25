import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, vi } from 'vitest';
import CollageTextDialog from './CollageTextDialog';
import { CollageTextItem } from './collageDoc';

const text: CollageTextItem = {
  id: 'text-1',
  text: 'Hello world',
  x: 0,
  y: 0,
  width: 240,
  height: 60,
  fontSize: 32,
  color: '#e91e63'
};

it('prefills the text, size, and color from the given item', () => {
  render(<CollageTextDialog open text={text} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
  expect(screen.getByText('Size: 32px')).toBeInTheDocument();
});

it('saves the edited text and closes', async () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<CollageTextDialog open text={text} onClose={onClose} onSave={onSave} onDelete={vi.fn()} />);

  const input = screen.getByDisplayValue('Hello world');
  await userEvent.clear(input);
  await userEvent.type(input, 'New caption');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onSave).toHaveBeenCalledWith({ text: 'New caption', fontSize: 32, color: '#e91e63' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('calls onDelete then onClose when Delete is clicked', async () => {
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(<CollageTextDialog open text={text} onClose={onClose} onSave={vi.fn()} onDelete={onDelete} />);

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('calls onClose without saving when Cancel is clicked', async () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<CollageTextDialog open text={text} onClose={onClose} onSave={onSave} onDelete={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('updates size and color, reflecting size in the preview and saving both', async () => {
  const onSave = vi.fn();
  render(<CollageTextDialog open text={text} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

  fireEvent.change(screen.getByRole('slider'), { target: { value: 64 } });
  fireEvent.change(document.querySelector('input[type="color"]')!, { target: { value: '#00ff00' } });

  expect(screen.getByText('Size: 64px')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 64, color: '#00ff00' }));
});

it('falls back to its default state when open with no text item selected', () => {
  render(<CollageTextDialog open text={null} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Size: 32px')).toBeInTheDocument();
});

describe('more ways to style text', () => {
  it('saves a chosen font, italic, alignment, label and outline', async () => {
    const onSave = vi.fn();
    render(<CollageTextDialog open text={text} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Handwritten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    await userEvent.click(screen.getByRole('button', { name: 'Italic' }));
    await userEvent.click(screen.getByRole('button', { name: 'Align left' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Label behind the text' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Outline' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Shadow' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        fontFamily: 'hand',
        bold: false,
        italic: true,
        align: 'left',
        background: '#ffffff',
        outline: '#ffffff',
        shadow: true
      })
    );
  });

  it('picks a colour from the swatches', async () => {
    const onSave = vi.fn();
    render(<CollageTextDialog open text={text} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Text color #0ea5e9' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ color: '#0ea5e9' }));
  });

  it('swaps a sticker for another', async () => {
    const onSave = vi.fn();
    render(
      <CollageTextDialog
        open
        text={{ ...text, kind: 'sticker', text: '🎉' }}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Edit sticker')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sticker 🌹' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ text: '🌹' }));
  });

  it('changes a shape and its fill', async () => {
    const onSave = vi.fn();
    render(
      <CollageTextDialog
        open
        text={{ ...text, kind: 'shape', shape: 'circle', text: '' }}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Edit shape')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Star' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fill color #facc15' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ shape: 'star', color: '#facc15' }));
  });
});
