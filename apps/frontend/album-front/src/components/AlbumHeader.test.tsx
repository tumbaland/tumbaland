import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AlbumHeader from './AlbumHeader';
import { makeAlbum } from '../test/fixtures';

it('renders the album name, description, photo count, total size, and public/private status', () => {
  const album = makeAlbum({ description: 'Summer trip', photoCount: 1, totalSize: 1024 * 500, isPublic: true });
  render(<AlbumHeader album={album} onNavigateBack={vi.fn()} onUploadPhotos={vi.fn()} />);

  expect(screen.getByRole('heading', { level: 1, name: album.name })).toBeInTheDocument();
  expect(screen.getByText('Summer trip')).toBeInTheDocument();
  expect(screen.getByText('1 photo • 500 KB • Public')).toBeInTheDocument();
});

it('shows a plural photo count and private status', () => {
  const album = makeAlbum({ photoCount: 4, totalSize: 1024 * 1024 * 2, isPublic: false });
  render(<AlbumHeader album={album} onNavigateBack={vi.fn()} onUploadPhotos={vi.fn()} />);

  expect(screen.getByText('4 photos • 2 MB • Private')).toBeInTheDocument();
});

it('omits the size segment for an empty album', () => {
  const album = makeAlbum({ photoCount: 0, totalSize: 0, isPublic: false });
  render(<AlbumHeader album={album} onNavigateBack={vi.fn()} onUploadPhotos={vi.fn()} />);

  expect(screen.getByText('0 photos • Private')).toBeInTheDocument();
});

it('omits the description when the album has none', () => {
  const album = makeAlbum({ description: undefined });
  render(<AlbumHeader album={album} onNavigateBack={vi.fn()} onUploadPhotos={vi.fn()} />);

  expect(screen.queryByText(/summer/i)).not.toBeInTheDocument();
});

it('goes back to the albums list from the back button', async () => {
  const onNavigateBack = vi.fn();
  render(<AlbumHeader album={makeAlbum()} onNavigateBack={onNavigateBack} onUploadPhotos={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Back to albums' }));

  expect(onNavigateBack).toHaveBeenCalledTimes(1);
});

it('has no separate breadcrumb trail repeating the way back', () => {
  render(<AlbumHeader album={makeAlbum()} onNavigateBack={vi.fn()} onUploadPhotos={vi.fn()} />);

  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(2);
});

it('calls onUploadPhotos when the upload button is clicked', async () => {
  const onUploadPhotos = vi.fn();
  render(<AlbumHeader album={makeAlbum()} onNavigateBack={vi.fn()} onUploadPhotos={onUploadPhotos} />);

  await userEvent.click(screen.getByRole('button', { name: /upload media/i }));

  expect(onUploadPhotos).toHaveBeenCalledTimes(1);
});
