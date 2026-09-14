import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

// FileUpload is a Phase 7 component with its own upload/drag-drop logic —
// stub it so this test stays scoped to AlbumDetailPage's own logic. The
// stub exposes plain buttons wired to the real onUploadComplete/onClose
// props so this page's own callback-wiring can still be verified.
vi.mock('../components/FileUpload', () => ({
  default: ({ open, onUploadComplete, onClose }: { open: boolean; onUploadComplete: () => void; onClose: () => void }) =>
    open ? (
      <div>
        file upload
        <button onClick={onUploadComplete}>simulate upload complete</button>
        <button onClick={onClose}>simulate close upload</button>
      </div>
    ) : null
}));

vi.mock('../hooks/usePhotos', () => ({ usePhotos: vi.fn() }));
vi.mock('../hooks/useAlbumTags', () => ({
  useAlbumTags: vi.fn(),
  useBulkTagMutation: vi.fn(),
  albumTagKeys: { all: ['photo-tags'], album: (albumId: string) => ['photo-tags', albumId] }
}));
vi.mock('../services/albumService', () => ({ albumService: { getAlbumById: vi.fn(), setCoverPhoto: vi.fn() } }));

import { usePhotos } from '../hooks/usePhotos';
import { useAlbumTags, useBulkTagMutation } from '../hooks/useAlbumTags';
import { albumService } from '../services/albumService';
import { makeAlbum, makePhoto } from '../test/fixtures';
import AlbumDetailPage from './AlbumDetailPage';

// vitest 4's Mock type is a call+construct union, so ReturnType<typeof vi.fn>
// no longer satisfies ReturnType's `(...args: any) => any` constraint. Type the
// override against the real hook's return type instead of the mock's.
const mockedUsePhotos = vi.mocked(usePhotos);
const mockedUseAlbumTags = vi.mocked(useAlbumTags);
const mockedUseBulkTagMutation = vi.mocked(useBulkTagMutation);
const bulkUpdateTags = vi.fn().mockResolvedValue({ matched: 1, modified: 1, tags: [] });
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

function basePhotosReturn(overrides: Partial<ReturnType<typeof usePhotos>> = {}) {
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
  mockedUseAlbumTags.mockReturnValue({ tags: [], loading: false, error: null });
  bulkUpdateTags.mockResolvedValue({ matched: 1, modified: 1, tags: [] });
  mockedUseBulkTagMutation.mockReturnValue({ bulkUpdateTags, saving: false });
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

  // The header's Upload button (accessible name "Upload media") comes first;
  // an empty album's own upload prompt can match too, later in the page.
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

  await waitFor(() =>
    expect(updatePhoto).toHaveBeenCalledWith('p1', { title: 'Renamed', description: undefined, tags: [] })
  );
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

it('toggles selection of a single photo by clicking its card in select mode', async () => {
  const photos = [
    makePhoto({ _id: 'p1', signedUrl: 'https://cdn.example/p1.jpg' }),
    makePhoto({ _id: 'p2', signedUrl: 'https://cdn.example/p2.jpg' })
  ];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 2, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });
  await userEvent.click(screen.getByRole('button', { name: /^select$/i }));

  const [firstCard] = screen.getAllByRole('img');
  await userEvent.click(firstCard);
  expect(screen.getByText('1 selected')).toBeInTheDocument();

  await userEvent.click(firstCard);
  expect(screen.getByText('0 selected')).toBeInTheDocument();
});

it('cancels the single-photo delete confirmation without deleting', async () => {
  const deletePhoto = vi.fn().mockResolvedValue(undefined);
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, deletePhoto, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await openPhotoMenu();
  await userEvent.click(screen.getByText('Delete Photo'));
  await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

  expect(deletePhoto).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Delete Photo')).not.toBeInTheDocument());
});

it('cancels the bulk-delete confirmation without deleting', async () => {
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
  await userEvent.click(dialog.getByRole('button', { name: /^cancel$/i }));

  expect(deletePhoto).not.toHaveBeenCalled();
});

it('navigates to the photo detail page from the card menu', async () => {
  const photos = [makePhoto({ _id: 'p1', title: 'Sunset' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await openPhotoMenu();
  await userEvent.click(screen.getByText('View Details'));

  expect(mockedNavigate).toHaveBeenCalledWith('/albums/album-1/photos/p1');
});

it('changes page and page size via the pagination controls', async () => {
  const fetchPhotos = vi.fn();
  const photos = [makePhoto({ _id: 'p1' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, fetchPhotos, pagination: { page: 1, limit: 24, total: 50, pages: 3 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });

  await userEvent.click(screen.getAllByRole('button', { name: /go to page 2/i })[0]);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: '48' }));

  expect(screen.getByText('50 photos total')).toBeInTheDocument();
});

it('refreshes photos when an upload completes, and closes the dialog independently', async () => {
  const fetchPhotos = vi.fn();
  const photos = [makePhoto({ _id: 'p1' })];
  mockedUsePhotos.mockReturnValue(
    basePhotosReturn({ photos, fetchPhotos, pagination: { page: 1, limit: 24, total: 1, pages: 1 } })
  );

  renderPage();
  await screen.findByRole('heading', { name: 'Trip' });
  await userEvent.click(screen.getAllByRole('button', { name: /upload media/i })[0]);

  await userEvent.click(screen.getByText('simulate upload complete'));
  expect(fetchPhotos).toHaveBeenCalled();

  await userEvent.click(screen.getByText('simulate close upload'));
  expect(screen.queryByText('file upload')).not.toBeInTheDocument();
});


describe('tagging and tag filtering', () => {
  const taggedPhotos = [
    makePhoto({ _id: 'p1', title: 'Sunset', tags: ['beach'] }),
    makePhoto({ _id: 'p2', title: 'Pier', tags: [] })
  ];

  function withPhotos() {
    mockedUsePhotos.mockReturnValue(
      basePhotosReturn({ photos: taggedPhotos, pagination: { page: 1, limit: 24, total: 2, pages: 1 } })
    );
  }

  it('shows no tag filter row when the album has no tags', async () => {
    withPhotos();
    renderPage();
    await screen.findByRole('heading', { name: 'Trip' });

    expect(screen.queryByText(/filter by tag/i)).not.toBeInTheDocument();
  });

  it('passes the selected tag through to usePhotos', async () => {
    withPhotos();
    mockedUseAlbumTags.mockReturnValue({ tags: [{ tag: 'beach', count: 1 }], loading: false, error: null });

    renderPage();
    await screen.findByRole('heading', { name: 'Trip' });

    await userEvent.click(screen.getByText('beach (1)'));

    await waitFor(() =>
      expect(mockedUsePhotos).toHaveBeenCalledWith(
        'album-1',
        expect.objectContaining({ tags: ['beach'], tagMatch: 'all' })
      )
    );
  });

  it('opens the tag dialog from a card and saves the added tag', async () => {
    withPhotos();
    renderPage();
    await screen.findByRole('heading', { name: 'Trip' });

    await userEvent.click(screen.getAllByText('Add tags')[0]);
    await userEvent.type(screen.getByRole('combobox'), 'pier{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /save tags/i }));

    await waitFor(() =>
      expect(bulkUpdateTags).toHaveBeenCalledWith({ photoIds: ['p2'], add: ['pier'], remove: [] })
    );
  });

  it('tags the whole selection from the select-mode toolbar', async () => {
    withPhotos();
    renderPage();
    await screen.findByRole('heading', { name: 'Trip' });

    await userEvent.click(screen.getByRole('button', { name: /^select$/i }));
    await userEvent.click(screen.getByRole('button', { name: /select all on page/i }));
    await userEvent.click(screen.getByRole('button', { name: /^tag$/i }));

    expect(screen.getByText('Tag 2 photos')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('combobox'), 'trip{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /save tags/i }));

    await waitFor(() =>
      expect(bulkUpdateTags).toHaveBeenCalledWith({ photoIds: ['p1', 'p2'], add: ['trip'], remove: [] })
    );
    // Leaves select mode once the selection has been tagged.
    await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument());
  });

  it('keeps the Tag button disabled while nothing is selected', async () => {
    withPhotos();
    renderPage();
    await screen.findByRole('heading', { name: 'Trip' });

    await userEvent.click(screen.getByRole('button', { name: /^select$/i }));

    expect(screen.getByRole('button', { name: /^tag$/i })).toBeDisabled();
  });
});
