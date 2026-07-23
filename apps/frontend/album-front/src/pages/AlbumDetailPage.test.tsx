import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

// FileUpload is a Phase 7 component with its own upload/drag-drop logic —
// stub it so this test stays scoped to AlbumDetailPage's own logic.
vi.mock('../components/FileUpload', () => ({ default: () => <div>file upload</div> }));

vi.mock('../hooks/usePhotos', () => ({ usePhotos: vi.fn() }));
vi.mock('../services/albumService', () => ({ albumService: { getAlbumById: vi.fn(), setCoverPhoto: vi.fn() } }));

import { usePhotos } from '../hooks/usePhotos';
import { albumService } from '../services/albumService';
import { makeAlbum, makePhoto } from '../test/fixtures';
import AlbumDetailPage from './AlbumDetailPage';

const mockedUsePhotos = usePhotos as unknown as ReturnType<typeof vi.fn>;
const mockedGetAlbumById = albumService.getAlbumById as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/albums/album-1']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function basePhotosReturn(overrides: Partial<ReturnType<typeof mockedUsePhotos>> = {}) {
  return {
    photos: [],
    loading: false,
    error: null,
    pagination: { page: 1, limit: 24, total: 0, pages: 0 },
    fetchPhotos: vi.fn(),
    updatePhoto: vi.fn().mockResolvedValue(undefined),
    deletePhoto: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUsePhotos.mockReturnValue(basePhotosReturn());
  mockedGetAlbumById.mockResolvedValue(makeAlbum({ _id: 'album-1', name: 'Trip' }));
});

it('shows a spinner while the album is loading', () => {
  mockedGetAlbumById.mockReturnValue(new Promise(() => {}));

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error and a back link when the album fails to load', async () => {
  mockedGetAlbumById.mockRejectedValue(new Error('down'));

  renderPage();

  expect(await screen.findByText('down')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to albums/i }));
  expect(mockedNavigate).toHaveBeenCalledWith('/albums');
});

it('renders the album header and photos once loaded', async () => {
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();

  expect(await screen.findByRole('heading', { name: 'Trip' })).toBeInTheDocument();
});

it('opens the upload dialog from the header button', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  // Both the header button and the floating action button match "upload
  // media" (text vs. aria-label) — click the first.
  await userEvent.click(screen.getAllByRole('button', { name: /upload media/i })[0]);

  expect(screen.getByText('file upload')).toBeInTheDocument();
});

it('toggles select mode and shows the selection toolbar', async () => {
  const photos = [makePhoto({ _id: 'p1' }), makePhoto({ _id: 'p2' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 2, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await userEvent.click(screen.getByRole('button', { name: /^select$/i }));

  expect(screen.getByText('0 selected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /select all on page/i })).toBeInTheDocument();
});

it('selects all photos on the page and enables bulk delete', async () => {
  const photos = [makePhoto({ _id: 'p1' }), makePhoto({ _id: 'p2' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 2, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await userEvent.click(screen.getByRole('button', { name: /^select$/i }));
  await userEvent.click(screen.getByRole('button', { name: /select all on page/i }));

  expect(screen.getByText('2 selected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^delete$/i })).toBeEnabled();
});

it('shows a photos error alert when present', async () => {
  mockedUsePhotos.mockReturnValue(basePhotosReturn({ error: 'failed to load photos' }));

  renderPage();

  expect(await screen.findByText('failed to load photos')).toBeInTheDocument();
});

function openPhotoMenu() {
  const menuButtons = screen.getAllByRole('button');
  const trigger = menuButtons.find((b) => b.querySelector('[data-testid="MoreVertIcon"]'))!;
  return userEvent.click(trigger);
}

it('deletes a photo via the card menu and confirmation dialog', async () => {
  const deletePhoto = vi.fn().mockResolvedValue(undefined);
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, deletePhoto, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await openPhotoMenu();
  await userEvent.click(screen.getByText('Delete Photo'));
  await userEvent.click(screen.getByRole('button', { name: /^delete photo$/i }));

  await waitFor(() => expect(deletePhoto).toHaveBeenCalledWith('p1'));
});

it('edits a photo via the card menu and dialog', async () => {
  const updatePhoto = vi.fn().mockResolvedValue(undefined);
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, updatePhoto, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await openPhotoMenu();
  await userEvent.click(screen.getByText('Edit Photo'));
  const titleInput = screen.getByDisplayValue('Sunset');
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, 'Renamed');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => expect(updatePhoto).toHaveBeenCalledWith('p1', { title: 'Renamed', description: undefined }));
});

it('sets a cover photo via the card menu', async () => {
  (albumService.setCoverPhoto as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: makeAlbum({ _id: 'album-1', name: 'Trip', coverPhotoId: 'p1' })
  });
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await openPhotoMenu();
  await userEvent.click(screen.getByText('Set as Cover Photo'));

  await waitFor(() => expect(albumService.setCoverPhoto).toHaveBeenCalledWith('album-1', 'p1'));
  alertSpy.mockRestore();
});

it('bulk-deletes selected photos', async () => {
  const deletePhoto = vi.fn().mockResolvedValue(undefined);
  const photos = [makePhoto({ _id: 'p1' }), makePhoto({ _id: 'p2' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, deletePhoto, pagination: { page: 1, limit: 24, total: 2, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await userEvent.click(screen.getByRole('button', { name: /^select$/i }));
  await userEvent.click(screen.getByRole('button', { name: /select all on page/i }));
  await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  const dialog = within(screen.getByRole('dialog'));
  await userEvent.click(dialog.getByRole('button', { name: /^delete$/i }));

  await waitFor(() => expect(deletePhoto).toHaveBeenCalledTimes(2));
});

it('cancels select mode via the Cancel button', async () => {
  const photos = [makePhoto({ _id: 'p1' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await userEvent.click(screen.getByRole('button', { name: /^select$/i }));
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByText('0 selected')).not.toBeInTheDocument();
});
