import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotosGrid from './PhotosGrid';
import { makeAlbum, makePhoto } from '../test/fixtures';

const DENSITY_STORAGE_KEY = 'tumbaland:photoGridDensity';

const noop = () => {};
const baseProps = {
  album: makeAlbum(),
  searchTerm: '',
  photosLoading: false,
  photosError: null,
  onViewPhoto: noop,
  onEditPhoto: noop,
  onDeletePhoto: noop,
  onSetCoverPhoto: noop,
  onViewPhotoDetails: noop,
  onUploadPhotos: noop
};

beforeEach(() => {
  window.localStorage.clear();
});

it('shows an error alert when photosError is set', () => {
  render(<PhotosGrid {...baseProps} photos={[]} photosError="Failed to load" />);
  expect(screen.getByText('Failed to load')).toBeInTheDocument();
});

it('shows a spinner while loading', () => {
  render(<PhotosGrid {...baseProps} photos={[]} photosLoading />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an empty state with an upload button when there are no photos and no search', async () => {
  const onUploadPhotos = vi.fn();
  render(<PhotosGrid {...baseProps} photos={[]} onUploadPhotos={onUploadPhotos} />);

  expect(screen.getByText('No photos yet')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /upload media/i }));
  expect(onUploadPhotos).toHaveBeenCalled();
});

it('shows a "no results" empty state without an upload button when searching', () => {
  render(<PhotosGrid {...baseProps} photos={[]} searchTerm="sunset" />);
  expect(screen.getByText('No photos found')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /upload media/i })).not.toBeInTheDocument();
});

it('renders a card for every photo', () => {
  const photos = [makePhoto({ _id: 'p1', title: 'First' }), makePhoto({ _id: 'p2', title: 'Second' })];
  render(<PhotosGrid {...baseProps} photos={photos} />);

  expect(screen.getByText('First')).toBeInTheDocument();
  expect(screen.getByText('Second')).toBeInTheDocument();
});

it('marks the album cover photo', () => {
  const photos = [makePhoto({ _id: 'p1', title: 'First' }), makePhoto({ _id: 'p2', title: 'Second' })];
  render(<PhotosGrid {...baseProps} photos={photos} album={makeAlbum({ coverPhotoId: 'p2' })} />);
  expect(screen.getByText('Cover')).toBeInTheDocument();
});

it('defaults to Comfortable density and persists a change to localStorage', async () => {
  render(<PhotosGrid {...baseProps} photos={[makePhoto()]} />);

  const comfortableButton = screen.getByRole('button', { name: 'Comfortable grid' });
  expect(comfortableButton).toHaveAttribute('aria-pressed', 'true');

  await userEvent.click(screen.getByRole('button', { name: 'Tiny grid' }));

  expect(screen.getByRole('button', { name: 'Tiny grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(comfortableButton).toHaveAttribute('aria-pressed', 'false');
  expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('tiny');
});

it('restores a previously saved density from localStorage', () => {
  window.localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
  render(<PhotosGrid {...baseProps} photos={[makePhoto()]} />);
  expect(screen.getByRole('button', { name: 'Compact grid' })).toHaveAttribute('aria-pressed', 'true');
});

it('ignores an invalid stored density and falls back to Comfortable', () => {
  window.localStorage.setItem(DENSITY_STORAGE_KEY, 'huge');
  render(<PhotosGrid {...baseProps} photos={[makePhoto()]} />);
  expect(screen.getByRole('button', { name: 'Comfortable grid' })).toHaveAttribute('aria-pressed', 'true');
});

it('passes select mode through to photo cards, hiding their per-card menu button', () => {
  const photos = [makePhoto({ _id: 'p1', title: 'First' }), makePhoto({ _id: 'p2', title: 'Second' })];
  render(<PhotosGrid {...baseProps} photos={photos} selectMode selectedIds={new Set(['p1'])} onToggleSelectPhoto={vi.fn()} />);

  // The only buttons left should be the 4 density toggles — each photo
  // card's "⋮" menu button (no accessible name) is suppressed in select mode.
  const namedButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label'));
  expect(namedButtons).toHaveLength(4);
});
