import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AlbumCard from './AlbumCard';
import { makeAlbum } from '../test/fixtures';

it('renders the album name, description, and singular photo count', () => {
  const album = makeAlbum({ description: 'Summer trip', photoCount: 1 });
  render(<AlbumCard album={album} onView={vi.fn()} />);

  expect(screen.getByText(album.name)).toBeInTheDocument();
  expect(screen.getByText('Summer trip')).toBeInTheDocument();
  expect(screen.getByText('1 photo')).toBeInTheDocument();
});

it('renders a plural photo count', () => {
  render(<AlbumCard album={makeAlbum({ photoCount: 5 })} onView={vi.fn()} />);

  expect(screen.getByText('5 photos')).toBeInTheDocument();
});

it('shows up to 3 tags plus a +N overflow chip', () => {
  const album = makeAlbum({ tags: ['a', 'b', 'c', 'd', 'e'] });
  render(<AlbumCard album={album} onView={vi.fn()} />);

  expect(screen.getByText('a')).toBeInTheDocument();
  expect(screen.getByText('b')).toBeInTheDocument();
  expect(screen.getByText('c')).toBeInTheDocument();
  expect(screen.queryByText('d')).not.toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
});

it('renders the cover thumbnail image when a signed URL is available', () => {
  const album = makeAlbum({ coverPhoto: { thumbnailSignedUrl: 'https://cdn.example/thumb.jpg' } as never });
  render(<AlbumCard album={album} onView={vi.fn()} />);

  expect(screen.getByRole('img', { name: album.name })).toHaveAttribute('src', 'https://cdn.example/thumb.jpg');
});

it('falls back to the full signed URL when there is no thumbnail', () => {
  const album = makeAlbum({ coverPhoto: { signedUrl: 'https://cdn.example/full.jpg' } as never });
  render(<AlbumCard album={album} onView={vi.fn()} />);

  expect(screen.getByRole('img', { name: album.name })).toHaveAttribute('src', 'https://cdn.example/full.jpg');
});

it('shows a placeholder icon when there is no cover photo', () => {
  render(<AlbumCard album={makeAlbum()} onView={vi.fn()} />);

  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('calls onView when the card is clicked', async () => {
  const onView = vi.fn();
  const album = makeAlbum();
  render(<AlbumCard album={album} onView={onView} />);

  await userEvent.click(screen.getByText(album.name));

  expect(onView).toHaveBeenCalledWith(album);
});

describe('editButton slot', () => {
  it('renders the caller-supplied editButton without triggering onView', async () => {
    const onView = vi.fn();
    const album = makeAlbum();
    render(
      <AlbumCard
        album={album}
        onView={onView}
        editButton={<button aria-label="open menu" onClick={(e) => e.stopPropagation()}>menu</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'open menu' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'open menu' }));
    expect(onView).not.toHaveBeenCalled();
  });

  it('renders nothing in the editButton slot when none is given', () => {
    render(<AlbumCard album={makeAlbum()} onView={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'open menu' })).not.toBeInTheDocument();
  });
});
