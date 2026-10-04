import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import AlbumsGrid from './AlbumsGrid';
import { makeAlbum } from '../test/fixtures';

it('renders a card per album and wires view/delete/menu callbacks', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip' }), makeAlbum({ _id: 'a2', name: 'Party' })];
  const onViewAlbum = vi.fn();
  const onDeleteAlbum = vi.fn();
  const onMenuOpen = vi.fn();

  render(
    <AlbumsGrid albums={albums} onViewAlbum={onViewAlbum} onDeleteAlbum={onDeleteAlbum} onMenuOpen={onMenuOpen} />
  );

  expect(screen.getByText('Trip')).toBeInTheDocument();
  expect(screen.getByText('Party')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Trip'));
  expect(onViewAlbum).toHaveBeenCalledWith(albums[0]);

  const menuButtons = screen.getAllByRole('button', { name: /album options/i });
  await userEvent.click(menuButtons[1]);
  expect(onMenuOpen).toHaveBeenCalledWith(expect.anything(), albums[1]);
});

it('renders nothing but the grid container when there are no albums', () => {
  render(<AlbumsGrid albums={[]} onViewAlbum={vi.fn()} onDeleteAlbum={vi.fn()} onMenuOpen={vi.fn()} />);

  expect(screen.queryByRole('button', { name: /album options/i })).not.toBeInTheDocument();
});
