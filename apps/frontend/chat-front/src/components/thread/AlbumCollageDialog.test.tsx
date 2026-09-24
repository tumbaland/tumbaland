import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AlbumCollageDialog } from './AlbumCollageDialog';
import type { PhotoAlbum, PhotoAlbumChoice } from '../../types';

const rome: PhotoAlbum = { mode: 'album', albumId: 'a-rome', albumName: 'Rome' };
const unset: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };
const albums = [
  { id: 'a-rome', name: 'Rome', photoCount: 12 },
  { id: 'a-home', name: 'Home', photoCount: 1 }
];

/** Holds the chat's album the way the thread does, so a choice shows up in the dialog. */
function Harness({
  initial,
  onStart,
  onClose
}: {
  initial: PhotoAlbum;
  onStart: (title: string, clientId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [photoAlbum, setPhotoAlbum] = useState(initial);
  const choose = async (choice: PhotoAlbumChoice) => {
    const album = 'albumId' in choice ? albums.find((a) => a.id === choice.albumId) : undefined;
    setPhotoAlbum(
      choice.mode === 'off' ? { mode: 'off', albumId: null, albumName: null } : { mode: 'album', albumId: album!.id, albumName: album!.name }
    );
  };
  return (
    <AlbumCollageDialog
      open
      onClose={onClose}
      photoAlbum={photoAlbum}
      loadAlbums={async () => albums}
      onChooseAlbum={choose}
      onStartCollage={onStart}
    />
  );
}

function renderDialog(initial: PhotoAlbum, onStart = vi.fn(async () => undefined)) {
  const onClose = vi.fn();
  render(<Harness initial={initial} onStart={onStart} onClose={onClose} />);
  return { onStart, onClose };
}

describe('AlbumCollageDialog', () => {
  it('shows where the photos go and offers the collage on that album', () => {
    renderDialog(rome);

    expect(screen.getByRole('button', { name: /Rome/ })).toBeInTheDocument();
    expect(screen.getByText('From the photos in Rome')).toBeInTheDocument();
    expect(screen.getByLabelText('Collage name')).toHaveValue('Rome');
  });

  it('makes the collage under the album’s name by default, with a key for retries', async () => {
    const { onStart, onClose } = renderDialog(rome);

    await userEvent.click(screen.getByRole('button', { name: 'Invite to make a collage' }));

    expect(onStart).toHaveBeenCalledWith('Rome', expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the same key when trying again after a failure', async () => {
    const onStart = vi.fn().mockRejectedValueOnce(new Error('HTTP error! status: 502')).mockResolvedValueOnce(undefined);
    renderDialog(rome, onStart);

    await userEvent.click(screen.getByRole('button', { name: 'Invite to make a collage' }));
    // Not the transport's own wording.
    expect(await screen.findByText('Could not make the collage. Try again.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Invite to make a collage' }));

    expect(onStart.mock.calls[1]![1]).toBe(onStart.mock.calls[0]![1]);
  });

  it('shows the server’s own words for a request it turned down', async () => {
    const refusal = Object.assign(new Error('This chat’s album no longer exists. Choose another one first.'), { status: 400 });
    renderDialog(rome, vi.fn().mockRejectedValue(refusal));

    await userEvent.click(screen.getByRole('button', { name: 'Invite to make a collage' }));

    expect(await screen.findByText(/album no longer exists/)).toBeInTheDocument();
  });

  it('asks for an album first when the chat has none', () => {
    renderDialog(unset);

    expect(screen.getByRole('button', { name: /Not chosen yet/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Collage name')).not.toBeInTheDocument();
    expect(screen.getByText('Choose an album above first.')).toBeInTheDocument();
  });

  it('chooses an album in place and comes back ready to make the collage', async () => {
    const { onClose } = renderDialog(unset);

    await userEvent.click(screen.getByRole('button', { name: /Not chosen yet/ }));
    await userEvent.click(await screen.findByText('Home'));

    await waitFor(() => expect(screen.getByLabelText('Collage name')).toHaveValue('Home'));
    expect(screen.getByText('From the photos in Home')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Not left locked by the save that brought it back here.
    expect(screen.getByRole('button', { name: 'Invite to make a collage' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  it('keeps a name the person typed when the album changes', async () => {
    renderDialog(rome);
    const name = screen.getByLabelText('Collage name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Our summer');

    await userEvent.click(screen.getByRole('button', { name: /Rome/ }));
    await userEvent.click(await screen.findByText('Home'));

    await waitFor(() => expect(screen.getByText('From the photos in Home')).toBeInTheDocument());
    expect(screen.getByLabelText('Collage name')).toHaveValue('Our summer');
  });

  it('goes back from the album list without changing anything', async () => {
    renderDialog(rome);

    await userEvent.click(screen.getByRole('button', { name: /Rome/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Collage name')).toHaveValue('Rome');
  });
});
