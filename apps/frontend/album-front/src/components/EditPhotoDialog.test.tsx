import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EditPhotoDialog from './EditPhotoDialog';
import { makePhoto } from '../test/fixtures';

it('prefills the title and description from the given photo', () => {
  const photo = makePhoto({ title: 'Sunset', description: 'At the beach' });
  render(<EditPhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByDisplayValue('Sunset')).toBeInTheDocument();
  expect(screen.getByDisplayValue('At the beach')).toBeInTheDocument();
});

it('renders the photo preview image when a signed URL is available', () => {
  const photo = makePhoto({ signedUrl: 'https://cdn.example/photo.jpg' });
  render(<EditPhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example/photo.jpg');
});

it('shows a "no preview" message when there is no signed URL', () => {
  render(<EditPhotoDialog open photo={makePhoto()} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByText('No preview available')).toBeInTheDocument();
});

it('renders nothing in the content area when there is no photo', () => {
  render(<EditPhotoDialog open photo={null} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.queryByLabelText(/photo title/i)).not.toBeInTheDocument();
});

it('saves the trimmed title and description, then closes', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const photo = makePhoto({ _id: 'photo-1', title: '', description: '' });
  render(<EditPhotoDialog open photo={photo} onClose={onClose} onSave={onSave} />);

  await userEvent.type(screen.getByLabelText(/photo title/i), '  New title  ');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(onSave).toHaveBeenCalledWith('photo-1', { title: 'New title', description: undefined });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('sends undefined for blank fields rather than empty strings', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const photo = makePhoto({ _id: 'photo-1' });
  render(<EditPhotoDialog open photo={photo} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(onSave).toHaveBeenCalledWith('photo-1', { title: undefined, description: undefined });
});

it('logs and stays open (does not call onClose) when onSave rejects', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('network down'));
  const onClose = vi.fn();
  render(<EditPhotoDialog open photo={makePhoto()} onClose={onClose} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
});

it('disables Cancel/close while saving is in flight', async () => {
  let resolveSave: () => void = () => {};
  const onSave = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
  render(<EditPhotoDialog open photo={makePhoto()} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  resolveSave();
});

it('calls onClose when Cancel is clicked (not saving)', async () => {
  const onClose = vi.fn();
  render(<EditPhotoDialog open photo={makePhoto()} onClose={onClose} onSave={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('resets to blank fields when the photo becomes null', () => {
  const photo = makePhoto({ title: 'Sunset' });
  const { rerender } = render(<EditPhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} />);
  expect(screen.getByDisplayValue('Sunset')).toBeInTheDocument();

  rerender(<EditPhotoDialog open photo={null} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.queryByDisplayValue('Sunset')).not.toBeInTheDocument();
});
