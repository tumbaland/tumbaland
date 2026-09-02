import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

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

it('counts the photos the per-year cap left out', () => {
  mockedUseMemories.mockReturnValue({
    memories: memories({ years: [{ year: 2024, yearsAgo: 2, photoCount: 9, photos: [memoryPhoto()] }] }),
    loading: false,
    isFetching: false,
    error: null
  });
  renderStrip();

  expect(screen.getByText('+8')).toBeInTheDocument();
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

  expect(mockedNavigate).toHaveBeenCalledWith('/albums/a1/photos/p1');
});
