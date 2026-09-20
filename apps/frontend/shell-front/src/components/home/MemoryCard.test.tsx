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

it('names the day and the album, and opens the album from the caption', async () => {
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

  await userEvent.click(screen.getByRole('button', { name: 'Open Tallinn' }));

  expect(onOpen).toHaveBeenCalledWith('/album/albums/album-1');
});

describe('several photos from the same day', () => {
  const day = (count: number) =>
    memories([
      {
        year: 2024,
        yearsAgo: 2,
        photoCount: count,
        photos: Array.from({ length: count }, (_, i) => photo(`p${i}`, { title: `Photo ${i}` }))
      }
    ]);

  it('steps through them in place rather than leaving the page', async () => {
    const onOpen = vi.fn();
    render(<MemoryCard memories={day(3)} onOpen={onOpen} />);

    expect(screen.getByText('Photo 0')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }));

    expect(screen.getByText('Photo 1')).toBeInTheDocument();
    // The three chips this replaced opened the album instead of the photo, so
    // the only thing they did was take you off the home page.
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('wraps around at both ends', async () => {
    render(<MemoryCard memories={day(3)} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByText('Photo 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByText('Photo 0')).toBeInTheDocument();
  });

  it('jumps straight to a photo from its dot', async () => {
    render(<MemoryCard memories={day(4)} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Photo 3 of 4' }));

    expect(screen.getByText('Photo 2')).toBeInTheDocument();
  });

  it('marks which slide is showing', async () => {
    render(<MemoryCard memories={day(2)} onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Photo 1 of 2' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Photo 2 of 2' })).not.toHaveAttribute('aria-current');
  });

  it('offers no arrows for a day with a single photo', () => {
    render(<MemoryCard memories={day(1)} onOpen={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
  });

  it('opens the album of the photo being shown', async () => {
    const onOpen = vi.fn();
    render(
      <MemoryCard
        memories={memories([
          {
            year: 2024,
            yearsAgo: 2,
            photoCount: 2,
            photos: [photo('a'), photo('b', { albumId: 'album-2' })]
          }
        ])}
        onOpen={onOpen}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open Tallinn' }));

    expect(onOpen).toHaveBeenCalledWith('/album/albums/album-2');
  });
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
