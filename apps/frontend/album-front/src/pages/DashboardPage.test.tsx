import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vite-plus/test';

const mockUseTenantFilter = vi.fn();
vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => mockUseTenantFilter() };
});

vi.mock('../hooks/useStatistics', () => ({ useStatistics: vi.fn() }));
vi.mock('../services/entitlementsService', () => ({ getMyEntitlements: vi.fn() }));
vi.mock('../hooks/useMemories', () => ({ useMemories: vi.fn() }));
vi.mock('../hooks/useCollage', () => ({ useCollageList: vi.fn() }));
vi.mock('../hooks/useHighlights', () => ({ useRecentPhotos: vi.fn(), useRandomPhoto: vi.fn() }));

import { useStatistics } from '../hooks/useStatistics';
import { getMyEntitlements } from '../services/entitlementsService';
import { useMemories } from '../hooks/useMemories';
import { useCollageList } from '../hooks/useCollage';
import { useRecentPhotos, useRandomPhoto } from '../hooks/useHighlights';
import DashboardPage from './DashboardPage';

const mockedUseStatistics = useStatistics as unknown as ReturnType<typeof vi.fn>;
const mockedGetMyEntitlements = getMyEntitlements as unknown as ReturnType<typeof vi.fn>;
const mockedUseMemories = useMemories as unknown as ReturnType<typeof vi.fn>;
const mockedUseCollageList = useCollageList as unknown as ReturnType<typeof vi.fn>;
const mockedUseRecentPhotos = useRecentPhotos as unknown as ReturnType<typeof vi.fn>;
const mockedUseRandomPhoto = useRandomPhoto as unknown as ReturnType<typeof vi.fn>;

const entitlements = {
  email: 'user@example.com',
  planCode: 'free',
  status: null,
  limits: {
    meters: { storageBytes: 1024 * 1024 * 1024, aiJobs: 25, trackedTickers: 3, seats: 1 },
    features: { cleanExport: false },
    retentionDays: 90
  },
  usage: { storageBytes: 1024, aiJobs: 0, trackedTickers: 0, seats: 1 }
};

const statistics = {
  overview: { totalAlbums: 3, totalPhotos: 100, totalStorage: 1024, averagePhotoSize: 100 },
  timeSeries: { albumsCreated: [], photosUploaded: [] },
  tags: [],
  groups: [],
  albums: [{ albumId: 'a1', name: 'Trip', totalSize: 512, photoCount: 3 }]
};

const memories = {
  date: '2026-09-20',
  windowDays: 0,
  totalPhotos: 1,
  years: [
    {
      year: 2024,
      yearsAgo: 2,
      photoCount: 1,
      photos: [
        {
          _id: 'p1',
          albumId: 'a1',
          albumName: 'Trip',
          title: 'Harbour',
          originalName: 'harbour.jpg',
          memoryDate: '2024-09-20',
          dateSource: 'taken'
        }
      ]
    }
  ]
};

const recentPhoto = {
  _id: 'p9',
  albumId: 'a1',
  albumName: 'Trip',
  originalName: 'newest.jpg',
  title: '',
  thumbnailSignedUrl: 'https://example.test/newest-thumb.jpg',
  signedUrl: 'https://example.test/newest.jpg',
  takenAt: '2026-09-19T08:00:00.000Z',
  dateSource: 'taken' as const
};

const collages = [
  {
    _id: 'c1',
    title: 'Summer wall',
    config: {},
    albumIds: [],
    ownerId: 'u1',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-18T10:00:00.000Z'
  },
  {
    _id: 'c2',
    title: 'Winter wall',
    config: {},
    albumIds: [],
    ownerId: 'u1',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z'
  }
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenantFilter.mockReturnValue(undefined);
  mockedGetMyEntitlements.mockResolvedValue(entitlements);
  // Both cards are silent by default, so a test that does not care about them
  // is not asserting around their content.
  mockedUseMemories.mockReturnValue({ memories: null, error: null });
  mockedUseCollageList.mockReturnValue({ data: [], error: null });
  mockedUseRecentPhotos.mockReturnValue({ photos: [], error: null });
  mockedUseRandomPhoto.mockReturnValue({
    photo: null,
    loading: false,
    isFetching: false,
    error: null,
    showAnother: vi.fn()
  });
});

it('shows a progress bar (not the charts) while loading', () => {
  mockedUseStatistics.mockReturnValue({
    statistics: null,
    loading: true,
    isFetching: false,
    error: null,
    refetch: vi.fn()
  });

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.queryByText('Total Albums')).not.toBeInTheDocument();
});

it('shows a retryable error when there is an error and no cached statistics', async () => {
  const refetch = vi.fn();
  mockedUseStatistics.mockReturnValue({
    statistics: null,
    loading: false,
    isFetching: false,
    error: 'network down',
    refetch
  });

  renderPage();

  expect(screen.getByText('network down')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('shows an info message when there is no statistics data and no error', () => {
  mockedUseStatistics.mockReturnValue({
    statistics: null,
    loading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn()
  });

  renderPage();

  expect(screen.getByText('No statistics data available')).toBeInTheDocument();
});

it('renders the overview and the storage chart once statistics are available', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByText('Total Albums')).toBeInTheDocument();
  expect(screen.getByText('Storage Usage')).toBeInTheDocument();
});

it('no longer carries the charts that said nothing: activity, tags, group split', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.queryByText('Activity Over Time')).not.toBeInTheDocument();
  expect(screen.queryByText(/popular tags/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/group distribution/i)).not.toBeInTheDocument();
});

it('shows On this day when today has history', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  mockedUseMemories.mockReturnValue({ memories, error: null });

  renderPage();

  expect(screen.getByRole('heading', { name: 'On this day' })).toBeInTheDocument();
  expect(screen.getByText('2 years ago')).toBeInTheDocument();
});

it('shows the most recently edited collages first', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  mockedUseCollageList.mockReturnValue({ data: collages, error: null });

  renderPage();

  expect(screen.getByRole('heading', { name: 'Recent collages' })).toBeInTheDocument();
  const titles = screen.getAllByText(/wall$/).map((node) => node.textContent);
  expect(titles).toEqual(['Summer wall', 'Winter wall']);
});

it('shows the newest uploads', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  mockedUseRecentPhotos.mockReturnValue({ photos: [recentPhoto], error: null });

  renderPage();

  expect(screen.getByRole('heading', { name: 'Just added' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /newest\.jpg/ })).toBeInTheDocument();
});

it('shows a photo to rediscover', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  mockedUseRandomPhoto.mockReturnValue({
    photo: { ...recentPhoto, takenAt: '2023-05-01T08:00:00.000Z' },
    loading: false,
    isFetching: false,
    error: null,
    showAnother: vi.fn()
  });

  renderPage();

  expect(screen.getByRole('heading', { name: 'Remember this?' })).toBeInTheDocument();
});

it('leaves out every optional card when there is nothing for any of them', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  // An empty heading over nothing is worse than no heading.
  expect(screen.queryByRole('heading', { name: 'On this day' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Just added' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Remember this?' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Recent collages' })).not.toBeInTheDocument();
});

it('passes the per-album storage breakdown through to the storage chart', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByText('Largest albums')).toBeInTheDocument();
  expect(screen.getByText('Trip')).toBeInTheDocument();
  expect(screen.getByText('512 B')).toBeInTheDocument();
});

it('keeps the header to a title and a refresh, with no repeated section links', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  renderPage();

  // The albums *card* is a link to albums now, so the check is scoped to the
  // header rather than the page: it is the header that must not repeat the
  // section tabs as a row of buttons.
  const header = screen.getByRole('heading', { level: 1, name: 'Dashboard' }).parentElement!;
  const headerButtons = within(header)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));

  expect(headerButtons).toEqual(['Refresh statistics']);
});

it('calls refetch when the refresh button is clicked', async () => {
  const refetch = vi.fn();
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch });

  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /refresh statistics/i }));

  expect(refetch).toHaveBeenCalledTimes(1);
});

it('shows a non-blocking progress indicator and disables refresh while refetching', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: true, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByRole('button', { name: /refresh statistics/i })).toBeDisabled();
  expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
});

it('lists collages before "Remember this?", which shares the last line with storage', async () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  mockedUseCollageList.mockReturnValue({ data: collages, error: null });
  mockedUseRandomPhoto.mockReturnValue({
    photo: recentPhoto,
    loading: false,
    isFetching: false,
    error: null,
    showAnother: vi.fn()
  });

  renderPage();

  const collage = await screen.findByText('Summer wall');
  const remember = screen.getByText('Remember this?');
  expect(collage.compareDocumentPosition(remember) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  const lastLine = screen.getByTestId('rediscover-and-storage');
  expect(within(lastLine).getByText('Remember this?')).toBeInTheDocument();
  expect(within(lastLine).getByText('Storage Usage')).toBeInTheDocument();
});
