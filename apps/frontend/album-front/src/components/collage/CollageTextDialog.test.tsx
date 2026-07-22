import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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
