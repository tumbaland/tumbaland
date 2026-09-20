import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentPhotos } from './RecentPhotos';
import type { HomePhoto } from '../../services/homeApi';

const photo = (id: string, over: Partial<HomePhoto> = {}): HomePhoto => ({
  _id: id,
  originalName: `${id}.jpg`,
  albumId: `album-${id}`,
  createdAt: '2026-09-19T10:00:00Z',
  thumbnailSignedUrl: `https://files.example/${id}-thumb.jpg`,
  ...over
});

it('shows a thumbnail per photo and opens the album it belongs to', async () => {
  const onOpen = vi.fn();
  render(<RecentPhotos photos={[photo('a', { title: 'Pier' }), photo('b')]} onOpen={onOpen} />);

  expect(screen.getAllByRole('button')).toHaveLength(2);

  await userEvent.click(screen.getByRole('button', { name: 'Pier' }));

  expect(onOpen).toHaveBeenCalledWith('/album/albums/album-a');
});

it('names a photo by its filename when it has no title', () => {
  render(<RecentPhotos photos={[photo('b')]} onOpen={vi.fn()} />);

  expect(screen.getByRole('button', { name: 'b.jpg' })).toBeInTheDocument();
});

it('renders nothing when there are no photos yet', () => {
  const { container } = render(<RecentPhotos photos={[]} onOpen={vi.fn()} />);

  expect(container).toBeEmptyDOMElement();
});

it('crops its tiles above centre, where faces are', () => {
  // The middle of a portrait is a torso. Cropped rather than fitted, unlike
  // the memory card: an 88px tile that letterboxed would be mostly blur.
  render(<RecentPhotos photos={[photo('a')]} onOpen={vi.fn()} />);

  const tile = document.querySelector('img') as HTMLImageElement;

  expect(getComputedStyle(tile).objectFit).toBe('cover');
  expect(getComputedStyle(tile).objectPosition).toBe('center 25%');
});
