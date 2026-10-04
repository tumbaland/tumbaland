import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vite-plus/test';

const mockedNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

vi.mock('../hooks/useMemories', () => ({ useMemories: vi.fn() }));

import { useMemories } from '../hooks/useMemories';
import { Memories, MemoryPhoto } from '../types';
import { makePhoto } from '../test/fixtures';
import OnThisDay from './OnThisDay';

const mockedUseMemories = useMemories as unknown as ReturnType<typeof vi.fn>;

const memoryPhoto = (over: Partial<MemoryPhoto> = {}): MemoryPhoto => ({
  ...makePhoto({ _id: 'p1', albumId: 'a1', originalName: 'beach.jpg', thumbnailSignedUrl: 'https://x/thumb.jpg' }),
  albumName: 'Summer',
  memoryDate: '2024-09-03',
  dateSource: 'taken',
  ...over
});

const memories = (over: Partial<Memories> = {}): Memories => ({
  date: '2026-09-03',
  windowDays: 3,
  totalPhotos: 1,
  years: [{ year: 2024, yearsAgo: 2, photoCount: 1, photos: [memoryPhoto()] }],
  ...over
});

const renderStrip = () =>
  render(
    <MemoryRouter>
      <OnThisDay />
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

it('renders nothing while there is no data yet', () => {
  mockedUseMemories.mockReturnValue({ memories: null, loading: true, isFetching: true, error: null });
  const { container } = renderStrip();
  expect(container).toBeEmptyDOMElement();
});

it('renders nothing when today has no history', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [], totalPhotos: 0 }),
    loading: false,
    isFetching: false,
    error: null
  });
  const { container } = renderStrip();
  expect(container).toBeEmptyDOMElement();
});

it('stays silent on a failure rather than showing an error above the albums', () => {
  mockedUseMemories.mockReturnValue({ memories: null, loading: false, isFetching: false, error: 'boom' });
  const { container } = renderStrip();
  expect(container).toBeEmptyDOMElement();
});

it('renders a year row with its photos', () => {
  mockedUseMemories.mockReturnValue({ memories: memories(), loading: false, isFetching: false, error: null });
  renderStrip();

  expect(screen.getByText('On this day')).toBeInTheDocument();
  expect(screen.getByText('2 years ago')).toBeInTheDocument();
  expect(screen.getByText('2024 · 1 photo')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'beach.jpg' })).toHaveAttribute('src', 'https://x/thumb.jpg');
});

it('says "a year ago" for the previous year', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2025, yearsAgo: 1, photoCount: 2, photos: [memoryPhoto()] }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getByText('a year ago')).toBeInTheDocument();
  expect(screen.getByText('2025 · 2 photos')).toBeInTheDocument();
});

it('shows only the most recent year, as one row under the heading', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({
      totalPhotos: 2,
      years: [
        { year: 2025, yearsAgo: 1, photoCount: 1, photos: [memoryPhoto({ _id: 'p25', originalName: 'recent.jpg' })] },
        { year: 2024, yearsAgo: 2, photoCount: 1, photos: [memoryPhoto({ _id: 'p24', originalName: 'older.jpg' })] }
      ]
    }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getByText('a year ago')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'recent.jpg' })).toBeInTheDocument();
  expect(screen.queryByText('2 years ago')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'older.jpg' })).not.toBeInTheDocument();
});

it('still says how many photos the day holds, in the heading', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2024, yearsAgo: 2, photoCount: 9, photos: [memoryPhoto()] }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  // The count used to be a dead '+8' tile that showed nothing and could not be
  // clicked. It is a photo's place now; the number lives in the heading.
  expect(screen.getByText(/9 photos/)).toBeInTheDocument();
  expect(screen.queryByText('+8')).not.toBeInTheDocument();
});

it('spends every tile on a photo, with no counter taking a slot', () => {
  const photos = Array.from({ length: 9 }, (_, i) => memoryPhoto({ _id: `p${i}`, originalName: `img-${i}.jpg` }));
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2025, yearsAgo: 1, photoCount: 9, photos }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  // Eight is the widest row (md). Each is a real photo, and each opens.
  expect(screen.getAllByRole('button')).toHaveLength(8);
  expect(screen.queryByRole('img', { name: /more photos/ })).not.toBeInTheDocument();
});

it('renders the tiles a narrow screen hides, so resizing reveals them', () => {
  const photos = Array.from({ length: 8 }, (_, i) => memoryPhoto({ _id: `p${i}`, originalName: `img-${i}.jpg` }));
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2025, yearsAgo: 1, photoCount: 8, photos }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  // They are in the DOM at every width; a media query decides which are shown,
  // so widening the window needs no resize listener and drops no photo.
  expect(screen.getByRole('button', { name: /img-7\.jpg/ })).toBeInTheDocument();
});

it('shows all four photos and no count when that is the whole day', () => {
  const photos = Array.from({ length: 4 }, (_, i) => memoryPhoto({ _id: `p${i}`, originalName: `img-${i}.jpg` }));
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2025, yearsAgo: 1, photoCount: 4, photos }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getAllByRole('button')).toHaveLength(4);
  expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
});

it('says when a photo is remembered on its upload date', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({
      years: [
        {
          year: 2024,
          yearsAgo: 2,
          photoCount: 1,
          photos: [memoryPhoto({ dateSource: 'uploaded' })]
        }
      ]
    }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getByRole('button', { name: /\(uploaded\)/ })).toBeInTheDocument();
});

it('falls back to the original signed URL when there is no thumbnail', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({
      years: [
        {
          year: 2024,
          yearsAgo: 2,
          photoCount: 1,
          photos: [memoryPhoto({ thumbnailSignedUrl: undefined, signedUrl: 'https://x/full.jpg' })]
        }
      ]
    }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getByRole('img', { name: 'beach.jpg' })).toHaveAttribute('src', 'https://x/full.jpg');
});

it('opens the photo it was given, in its own album', async () => {
  mockedUseMemories.mockReturnValue({ memories: memories(), loading: false, isFetching: false, error: null });
  renderStrip();

  await userEvent.click(screen.getByRole('button', { name: /beach\.jpg/ }));

  expect(mockedNavigate).toHaveBeenCalledWith('/album/albums/a1/photos/p1');
});

it('labels a photo in plain punctuation, with no em dash', () => {
  // House rule for anything a person reads: an em dash is the clearest tell
  // that a machine wrote the sentence.
  mockedUseMemories.mockReturnValue({
    memories: memories(),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  const label = screen.getAllByRole('button')[0].getAttribute('aria-label') ?? '';
  expect(label).not.toContain('—');
  expect(label.length).toBeGreaterThan(0);
});
