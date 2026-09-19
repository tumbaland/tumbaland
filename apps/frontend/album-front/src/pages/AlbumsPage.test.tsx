import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => undefined };
});

vi.mock('../hooks/useAlbums', () => ({ useAlbums: vi.fn() }));

// Its own tests cover the strip; here it would only drag a query client in.
vi.mock('../components/OnThisDay', () => ({ default: () => <div>OnThisDay</div> }));

import { useAlbums } from '../hooks/useAlbums';
import { makeAlbum } from '../test/fixtures';
import AlbumsPage from './AlbumsPage';

// vitest 4's Mock type is a call+construct union, so ReturnType<typeof vi.fn>
// no longer satisfies ReturnType's `(...args: any) => any` constraint. Type the
// override against the real hook's return type instead of the mock's.
const mockedUseAlbums = vi.mocked(useAlbums);

function baseAlbumsReturn(overrides: Partial<ReturnType<typeof useAlbums>> = {}) {
  return {
    albums: [],
    loading: false,
    isFetching: false,
    error: null,
    createAlbum: vi.fn().mockResolvedValue(undefined),
    updateAlbum: vi.fn().mockResolvedValue(undefined),
    deleteAlbum: vi.fn().mockResolvedValue(undefined),
    fetchAlbums: vi.fn(),
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    ...overrides
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AlbumsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('shows a spinner while loading', () => {
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ loading: true }));

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows the empty state when there are no albums', () => {
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn());

  renderPage();

  expect(screen.getByText('No albums yet')).toBeInTheDocument();
});

it('shows an error alert when the query has an error', () => {
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ error: 'network down' }));

  renderPage();

  expect(screen.getByText('network down')).toBeInTheDocument();
});

it('renders the album grid and count when albums are present', () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip' })];
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ albums, pagination: { page: 1, limit: 20, total: 1, pages: 1 } }));

  renderPage();

  expect(screen.getByText('Trip')).toBeInTheDocument();
  expect(screen.getByText('1 album')).toBeInTheDocument();
});

it('navigates to the album detail page when a card is clicked', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip' })];
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ albums, pagination: { page: 1, limit: 20, total: 1, pages: 1 } }));

  renderPage();
  await userEvent.click(screen.getByText('Trip'));

  expect(mockedNavigate).toHaveBeenCalledWith('/albums/a1');
});

it('opens the create dialog and creates an album', async () => {
  const createAlbum = vi.fn().mockResolvedValue(undefined);
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ createAlbum }));

  renderPage();
  // Both the page header and the empty-state show a "Create Album" button;
  // the header one (first in document order) opens the dialog.
  await userEvent.click(screen.getAllByRole('button', { name: /create album/i })[0]);
  const dialog = within(screen.getByRole('dialog'));
  await userEvent.type(dialog.getByLabelText('Album Name'), 'New album');
  await userEvent.click(dialog.getByRole('button', { name: /create album/i }));

  await waitFor(() => expect(createAlbum).toHaveBeenCalledWith(expect.objectContaining({ name: 'New album' })));
});

it('opens the edit dialog via the card menu and saves changes', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip' })];
  const updateAlbum = vi.fn().mockResolvedValue(undefined);
  mockedUseAlbums.mockReturnValue(
    baseAlbumsReturn({ albums, updateAlbum, pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
  );

  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /album options/i }));
  await userEvent.click(screen.getByText('Edit Album'));

  const nameInput = screen.getByDisplayValue('Trip');
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Renamed');
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => expect(updateAlbum).toHaveBeenCalledWith('a1', expect.objectContaining({ name: 'Renamed' })));
});

it('deletes an album via the card menu and confirmation dialog', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip', photoCount: 0 })];
  const deleteAlbum = vi.fn().mockResolvedValue(undefined);
  mockedUseAlbums.mockReturnValue(
    baseAlbumsReturn({ albums, deleteAlbum, pagination: { page: 1, limit: 20, total: 1, pages: 1 } })
  );

  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /album options/i }));
  await userEvent.click(screen.getByText('Delete Album'));
  await userEvent.click(screen.getByRole('button', { name: /^delete album$/i }));

  await waitFor(() => expect(deleteAlbum).toHaveBeenCalledWith('a1'));
});

it('disables deleting an album that still has photos', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip', photoCount: 3 })];
  mockedUseAlbums.mockReturnValue(baseAlbumsReturn({ albums, pagination: { page: 1, limit: 20, total: 1, pages: 1 } }));

  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /album options/i }));

  expect(screen.getByText('Delete Album').closest('li')).toHaveAttribute('aria-disabled', 'true');
});

it('shows pagination controls when there is more than one page', async () => {
  const albums = [makeAlbum({ _id: 'a1', name: 'Trip' })];
  mockedUseAlbums.mockReturnValue(
    baseAlbumsReturn({ albums, pagination: { page: 1, limit: 20, total: 40, pages: 2 } })
  );

  renderPage();

  expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
});
