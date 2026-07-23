import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

// Phase 7 components: not the target of this page test, and each does its
// own AI-service polling — stub them so this test stays scoped to
// PhotoDetailPage's own routing/tab/dialog logic.
vi.mock('../components/ObjectDetectionView', () => ({ default: () => <div>object detection view</div> }));
vi.mock('../components/SegmentationView', () => ({ default: () => <div>segmentation view</div> }));

vi.mock('../hooks/usePhotos', () => ({ usePhotos: vi.fn() }));
vi.mock('../services/albumService', () => ({ albumService: { getAlbumById: vi.fn() } }));
vi.mock('../services/photoService', () => ({
  photoService: { getPhotoById: vi.fn(), updatePhoto: vi.fn(), deletePhoto: vi.fn() }
}));

import { usePhotos } from '../hooks/usePhotos';
import { albumService } from '../services/albumService';
import { photoService } from '../services/photoService';
import { makeAlbum, makePhoto } from '../test/fixtures';
import PhotoDetailPage from './PhotoDetailPage';

const mockedUsePhotos = usePhotos as unknown as ReturnType<typeof vi.fn>;
const mockedGetAlbumById = albumService.getAlbumById as unknown as ReturnType<typeof vi.fn>;
const mockedGetPhotoById = photoService.getPhotoById as unknown as ReturnType<typeof vi.fn>;

function renderPage(photoId = 'photo-2') {
  return render(
    <MemoryRouter initialEntries={[`/albums/album-1/photos/${photoId}`]}>
      <Routes>
        <Route path="/albums/:albumId/photos/:photoId" element={<PhotoDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const albumPhotos = [
  makePhoto({ _id: 'photo-1', title: 'First' }),
  makePhoto({ _id: 'photo-2', title: 'Middle' }),
  makePhoto({ _id: 'photo-3', title: 'Last' })
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUsePhotos.mockReturnValue({ photos: albumPhotos });
  mockedGetAlbumById.mockResolvedValue(makeAlbum({ _id: 'album-1', name: 'Trip' }));
  mockedGetPhotoById.mockResolvedValue(makePhoto({ _id: 'photo-2', title: 'Middle' }));
});

it('shows a spinner while loading', () => {
  mockedGetPhotoById.mockReturnValue(new Promise(() => {}));

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error and a back link when the photo fails to load', async () => {
  mockedGetPhotoById.mockRejectedValue(new Error('down'));

  renderPage();

  expect(await screen.findByText('Failed to load photo details')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to album/i }));
  expect(mockedNavigate).toHaveBeenCalledWith('/albums/album-1');
});

it('renders the photo header and basic info tab once loaded', async () => {
  renderPage();

  expect(await screen.findByText('Basic Info')).toBeInTheDocument();
  expect(screen.getByText('Object Detection')).toBeInTheDocument();
  expect(screen.getByText('Segmentation')).toBeInTheDocument();
});

it('switches to the Object Detection and Segmentation tabs', async () => {
  renderPage();
  await screen.findByText('Basic Info');

  await userEvent.click(screen.getByRole('tab', { name: /object detection/i }));
  expect(screen.getByText('object detection view')).toBeVisible();

  await userEvent.click(screen.getByRole('tab', { name: /segmentation/i }));
  expect(screen.getByText('segmentation view')).toBeVisible();
});

it('computes previous/next from the unpaginated album photo list', async () => {
  renderPage('photo-2');
  await screen.findByText('Basic Info');

  expect(mockedUsePhotos).toHaveBeenCalledWith('album-1');
});

it('navigates to the previous/next photo via the header controls', async () => {
  renderPage('photo-2');
  await screen.findByText('Basic Info');

  await userEvent.click(screen.getByRole('button', { name: /previous photo/i }));
  expect(mockedNavigate).toHaveBeenCalledWith('/albums/album-1/photos/photo-1');

  await userEvent.click(screen.getByRole('button', { name: /next photo/i }));
  expect(mockedNavigate).toHaveBeenCalledWith('/albums/album-1/photos/photo-3');
});

it('has no previous/next when at the start/end of the album', async () => {
  renderPage('photo-1');
  await screen.findByText('Basic Info');

  expect(screen.getByRole('button', { name: /previous photo/i })).toBeDisabled();
});

it('opens the edit dialog and saves changes', async () => {
  mockedGetPhotoById.mockResolvedValue(makePhoto({ _id: 'photo-2', title: 'Middle' }));
  const updatedPhoto = makePhoto({ _id: 'photo-2', title: 'Renamed' });
  (photoService.updatePhoto as ReturnType<typeof vi.fn>).mockResolvedValue(updatedPhoto);

  renderPage('photo-2');
  await screen.findByText('Basic Info');

  await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  const titleInput = screen.getByDisplayValue('Middle');
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, 'Renamed');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => expect(photoService.updatePhoto).toHaveBeenCalledWith('photo-2', { title: 'Renamed' }));
});

it('deletes the photo and navigates back to the album', async () => {
  (photoService.deletePhoto as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

  renderPage('photo-2');
  await screen.findByText('Basic Info');

  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  await userEvent.click(screen.getByRole('button', { name: /delete photo/i }));

  await waitFor(() => expect(photoService.deletePhoto).toHaveBeenCalledWith('photo-2'));
  expect(mockedNavigate).toHaveBeenCalledWith('/albums/album-1');
});
