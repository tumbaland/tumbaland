import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlbumPicker } from './AlbumPicker';
import type { PhotoAlbum } from '../../types';

const unset: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };
const albums = [
  { id: 'a-rome', name: 'Rome', photoCount: 12 },
  { id: 'a-home', name: 'Home', photoCount: 1 }
];

const renderPicker = (props: Partial<Parameters<typeof AlbumPicker>[0]> = {}) => {
  const onChoose = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <AlbumPicker
      open
      onClose={onClose}
      current={unset}
      loadAlbums={async () => albums}
      onChoose={onChoose}
      {...props}
    />
  );
  return { onChoose, onClose };
};

describe('AlbumPicker', () => {
  it("lists the group's albums and picks one", async () => {
    const { onChoose, onClose } = renderPicker();

    await userEvent.click(await screen.findByText('Rome'));

    expect(onChoose).toHaveBeenCalledWith({ mode: 'album', albumId: 'a-rome' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('just closes when the album already chosen is picked again', async () => {
    const { onChoose, onClose } = renderPicker({ current: { mode: 'album', albumId: 'a-rome', albumName: 'Rome' } });

    await userEvent.click(await screen.findByText('Rome'));

    expect(onChoose).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('can be left without choosing anything', async () => {
    const { onChoose, onClose } = renderPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChoose).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('makes a new album by name', async () => {
    const { onChoose } = renderPicker();

    await userEvent.click(await screen.findByText('New album…'));
    await userEvent.type(screen.getByLabelText('Album name'), 'Paris');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onChoose).toHaveBeenCalledWith({ mode: 'album', newAlbumName: 'Paris' });
  });

  it('puts the no-album row above the albums, so it needs no scrolling', async () => {
    renderPicker();

    const off = await screen.findByText("Don't save to Album");
    const first = screen.getByText(albums[0]!.name);

    expect(off.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('can turn saving off', async () => {
    const { onChoose } = renderPicker();

    await userEvent.click(await screen.findByText("Don't save to Album"));

    expect(onChoose).toHaveBeenCalledWith({ mode: 'off' });
  });

  it('marks the album photos go to now', async () => {
    renderPicker({ current: { mode: 'album', albumId: 'a-rome', albumName: 'Rome' } });

    await screen.findByText('Rome');
    expect(screen.getAllByLabelText('Current')).toHaveLength(1);
  });

  it('stays open and says so when saving fails', async () => {
    const { onClose } = renderPicker({ onChoose: vi.fn(async () => Promise.reject(new Error('down'))) });

    await userEvent.click(await screen.findByText('Rome'));

    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is worded as a move for a photo already sent, with "none" taking it out', async () => {
    const { onChoose } = renderPicker({
      purpose: 'photo',
      current: { mode: 'album', albumId: 'a-rome', albumName: 'Rome' }
    });

    expect(screen.getByText('Move to album')).toBeInTheDocument();
    await userEvent.click(await screen.findByText('Not in an album'));

    expect(onChoose).toHaveBeenCalledWith({ mode: 'off' });
  });
});
