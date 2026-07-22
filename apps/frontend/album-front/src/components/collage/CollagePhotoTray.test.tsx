import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CollagePhotoTray, { AlbumPhoto } from './CollagePhotoTray';

const photos: AlbumPhoto[] = [
  { _id: 'p1', filename: 'a.jpg', title: 'Beach', thumbnailSignedUrl: 'https://cdn.example/a-thumb.jpg' },
  { _id: 'p2', filename: 'b.jpg', signedUrl: 'https://cdn.example/b-full.jpg' },
  { _id: 'p3', filename: 'c.jpg' }
];

it('shows the photo count and renders a tile per photo', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText(/photos \(3\)/i)).toBeInTheDocument();
  expect(screen.getAllByRole('img')).toHaveLength(2);
});

it('prefers the thumbnail signed URL over the full signed URL', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByRole('img', { name: 'Beach' })).toHaveAttribute('src', 'https://cdn.example/a-thumb.jpg');
});

it('falls back to the full signed URL when there is no thumbnail', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByRole('img', { name: 'b.jpg' })).toHaveAttribute('src', 'https://cdn.example/b-full.jpg');
});

it('shows a "No preview" placeholder when the photo has no URL at all', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText('No preview')).toBeInTheDocument();
});

it('calls onAddPhoto when a tile is clicked', async () => {
  const onAddPhoto = vi.fn();
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={onAddPhoto} />);

  await userEvent.click(screen.getByRole('img', { name: 'Beach' }));

  expect(onAddPhoto).toHaveBeenCalledWith(photos[0]);
});

it('shows a check icon on photos already used in the collage', () => {
  const { container } = render(
    <CollagePhotoTray photos={photos} usedPhotoIds={new Set(['p1'])} onAddPhoto={vi.fn()} />
  );

  expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeInTheDocument();
});

it('sets the drag payload and effect on dragstart, for dropping onto the canvas', () => {
  render(<CollagePhotoTray photos={photos} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  const tile = screen.getByRole('img', { name: 'Beach' }).closest('[draggable="true"]')!;
  const dataTransfer = { setData: vi.fn(), effectAllowed: '' };

  fireEvent.dragStart(tile, { dataTransfer });

  expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-collage-photo', 'p1');
  expect(dataTransfer.effectAllowed).toBe('copy');
});

it('shows the empty-state message when there are no photos', () => {
  render(<CollagePhotoTray photos={[]} usedPhotoIds={new Set()} onAddPhoto={vi.fn()} />);

  expect(screen.getByText(/no photos in the source albums yet/i)).toBeInTheDocument();
});
