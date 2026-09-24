import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollageStartDialog } from './CollageStartDialog';
import type { PhotoAlbum } from '../../types';

const rome: PhotoAlbum = { mode: 'album', albumId: 'a-rome', albumName: 'Rome' };
const unset: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };

function renderDialog(photoAlbum: PhotoAlbum, onStart = vi.fn(async () => undefined)) {
  const onClose = vi.fn();
  const onChooseAlbum = vi.fn();
  render(
    <CollageStartDialog open onClose={onClose} photoAlbum={photoAlbum} onChooseAlbum={onChooseAlbum} onStart={onStart} />
  );
  return { onStart, onClose, onChooseAlbum };
}

describe('CollageStartDialog', () => {
  it('makes the collage under the album’s name by default, with a key for retries', async () => {
    const { onStart, onClose } = renderDialog(rome);

    expect(screen.getByText(/Uses the photos in Rome/)).toBeInTheDocument();
    expect(screen.getByLabelText('Collage name')).toHaveValue('Rome');
    await userEvent.click(screen.getByRole('button', { name: 'Make collage' }));

    expect(onStart).toHaveBeenCalledWith('Rome', expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the same key when trying again after a failure', async () => {
    const onStart = vi.fn().mockRejectedValueOnce(new Error('HTTP error! status: 502')).mockResolvedValueOnce(undefined);
    renderDialog(rome, onStart);

    await userEvent.click(screen.getByRole('button', { name: 'Make collage' }));
    // Not the transport's own wording.
    expect(await screen.findByText('Could not make the collage. Try again.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make collage' }));

    expect(onStart.mock.calls[1]![1]).toBe(onStart.mock.calls[0]![1]);
  });

  it('shows the server’s own words for a request it turned down', async () => {
    const refusal = Object.assign(new Error('This chat’s album no longer exists. Choose another one first.'), { status: 400 });
    renderDialog(rome, vi.fn().mockRejectedValue(refusal));

    await userEvent.click(screen.getByRole('button', { name: 'Make collage' }));

    expect(await screen.findByText(/album no longer exists/)).toBeInTheDocument();
  });

  it('asks for an album first when the chat has none', async () => {
    const { onStart, onChooseAlbum } = renderDialog(unset);

    expect(screen.queryByLabelText('Collage name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose album' }));

    expect(onChooseAlbum).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
