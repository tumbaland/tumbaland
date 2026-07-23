import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EditAlbumDialog from './EditAlbumDialog';
import { makeAlbum } from '../test/fixtures';

it('prefills the name and description from the given album', () => {
  const album = makeAlbum({ name: 'Trip', description: 'Summer trip' });
  render(<EditAlbumDialog open album={album} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByDisplayValue('Trip')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Summer trip')).toBeInTheDocument();
});

it('shows a validation error and does not save when the name is blank', async () => {
  const onSave = vi.fn();
  const album = makeAlbum({ name: 'Trip' });
  render(<EditAlbumDialog open album={album} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.clear(screen.getByDisplayValue('Trip'));
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(screen.getByText('Album name is required')).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});

it('saves the trimmed name and description, then closes', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const album = makeAlbum({ _id: 'album-1', name: 'Trip', description: 'Old' });
  render(<EditAlbumDialog open album={album} onClose={onClose} onSave={onSave} />);

  const nameInput = screen.getByDisplayValue('Trip');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, '  Renamed  ');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(onSave).toHaveBeenCalledWith('album-1', { name: 'Renamed', description: 'Old' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows an error message when onSave rejects', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('network down'));
  const album = makeAlbum({ name: 'Trip' });
  render(<EditAlbumDialog open album={album} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(await screen.findByText('Failed to update album')).toBeInTheDocument();
});

it('calls onClose when Cancel is clicked', async () => {
  const onClose = vi.fn();
  render(<EditAlbumDialog open album={makeAlbum()} onClose={onClose} onSave={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('does nothing on save when there is no album', async () => {
  const onSave = vi.fn();
  render(<EditAlbumDialog open album={null} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(onSave).not.toHaveBeenCalled();
});
