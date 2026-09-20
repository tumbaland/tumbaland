import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryCard, pickYear, yearsAgoLabel } from './MemoryCard';
import type { Memories, MemoryYear } from '../../services/homeApi';

const photo = (id: string, over: Partial<MemoryYear['photos'][number]> = {}) =>
  ({
    _id: id,
    originalName: `${id}.jpg`,
    albumId: 'album-1',
    albumName: 'Tallinn',
    memoryDate: '2024-09-20',
    createdAt: '2024-09-20T10:00:00Z',
    signedUrl: `https://files.example/${id}.jpg`,
    thumbnailSignedUrl: `https://files.example/${id}-thumb.jpg`,
    ...over
  }) as MemoryYear['photos'][number];

const memories = (years: MemoryYear[]): Memories => ({ date: '2026-09-20', totalPhotos: 9, years });

describe('yearsAgoLabel', () => {
  it('says a year rather than "1 years"', () => {
    expect(yearsAgoLabel(1)).toBe('A year ago today');
  });

  it('counts the years beyond that', () => {
    expect(yearsAgoLabel(3)).toBe('3 years ago today');
  });
});

describe('pickYear', () => {
  it('builds the card around the year with the most to show', () => {
    const thin: MemoryYear = { year: 2025, yearsAgo: 1, photoCount: 1, photos: [photo('a')] };
    const rich: MemoryYear = { year: 2023, yearsAgo: 3, photoCount: 8, photos: [photo('b'), photo('c'), photo('d')] };

    expect(pickYear([thin, rich])).toBe(rich);
  });

  it('ignores a year the service counted but sent no photos for', () => {
    const counted: MemoryYear = { year: 2025, yearsAgo: 1, photoCount: 4, photos: [] };

    expect(pickYear([counted])).toBeNull();
  });
});

it('names the day and the album, and opens the album it came from', async () => {
  const onOpen = vi.fn();
  render(
    <MemoryCard
      memories={memories([{ year: 2024, yearsAgo: 2, photoCount: 5, photos: [photo('a'), photo('b')] }])}
      onOpen={onOpen}
    />
  );

  expect(screen.getByText('2 years ago today')).toBeInTheDocument();
  expect(screen.getByText('Tallinn')).toBeInTheDocument();
  expect(screen.getByText('5 photos')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button'));

  expect(onOpen).toHaveBeenCalledWith('/album/albums/album-1');
});

it("prefers the photo's own title over the album name", () => {
  render(
    <MemoryCard
      memories={memories([
        { year: 2024, yearsAgo: 2, photoCount: 1, photos: [photo('a', { title: 'Sunrise at the pier' })] }
      ])}
      onOpen={vi.fn()}
    />
  );

  expect(screen.getByText('Sunrise at the pier')).toBeInTheDocument();
  expect(screen.getByText('1 photo in Tallinn')).toBeInTheDocument();
});

it('renders nothing on a date with no history, rather than an empty-state card', () => {
  const { container } = render(<MemoryCard memories={memories([])} onOpen={vi.fn()} />);

  expect(container).toBeEmptyDOMElement();
});
