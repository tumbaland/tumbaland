import { render, screen, fireEvent } from '@testing-library/react';
import PhotoBasicInfo from './PhotoBasicInfo';
import { makePhoto } from '../../test/fixtures';

const formatFileSize = (bytes: number) => `${bytes} bytes`;
const formatDate = (date: string) => `formatted:${date}`;

function renderInfo(overrides: Partial<React.ComponentProps<typeof PhotoBasicInfo>> = {}) {
  const photo = makePhoto({
    title: 'Sunset',
    signedUrl: '/full.jpg',
    thumbnailUrl: '/thumb.jpg',
    size: 2048,
    width: 1920,
    height: 1080,
    createdAt: '2024-03-01T00:00:00.000Z',
    originalName: 'IMG_042.jpg',
    ...overrides.photo
  });
  return render(
    <PhotoBasicInfo photo={photo} formatFileSize={formatFileSize} formatDate={formatDate} {...overrides} />
  );
}

it('renders the photo image with alt text', () => {
  renderInfo();
  const img = screen.getByRole('img') as HTMLImageElement;
  expect(img.alt).toBe('Sunset');
});

it('shows file size, dimensions, and upload date via the provided formatters', () => {
  renderInfo();
  expect(screen.getByText('2048 bytes')).toBeInTheDocument();
  expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
  expect(screen.getByText('formatted:2024-03-01T00:00:00.000Z')).toBeInTheDocument();
});

it('shows "Unknown" dimensions when width/height are missing', () => {
  renderInfo({ photo: makePhoto({ width: undefined, height: undefined }) });
  expect(screen.getByText('Unknown')).toBeInTheDocument();
});

it('shows the description, or a fallback when there is none', () => {
  const { rerender } = renderInfo({ photo: makePhoto({ description: 'A lovely sunset' }) });
  expect(screen.getByText('A lovely sunset')).toBeInTheDocument();

  rerender(
    <PhotoBasicInfo photo={makePhoto({ description: undefined })} formatFileSize={formatFileSize} formatDate={formatDate} />
  );
  expect(screen.getByText('No description')).toBeInTheDocument();
});

it('shows the original filename', () => {
  renderInfo();
  expect(screen.getByText('IMG_042.jpg')).toBeInTheDocument();
});

it('renders tags when present and omits the section when there are none', () => {
  const { rerender } = renderInfo({ photo: makePhoto({ tags: ['beach', 'vacation'] }) });
  expect(screen.getByText('beach')).toBeInTheDocument();
  expect(screen.getByText('vacation')).toBeInTheDocument();

  rerender(
    <PhotoBasicInfo photo={makePhoto({ tags: [] })} formatFileSize={formatFileSize} formatDate={formatDate} />
  );
  expect(screen.queryByText('Tags')).not.toBeInTheDocument();
});

it('wires swipe gestures on the image container to onSwipeNext/onSwipePrevious', () => {
  const onSwipeNext = vi.fn();
  const onSwipePrevious = vi.fn();
  renderInfo({ onSwipeNext, onSwipePrevious });

  const swipeContainer = screen.getByRole('img').parentElement!;

  fireEvent.touchStart(swipeContainer, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(swipeContainer, { changedTouches: [{ clientX: 100, clientY: 100 }] });
  expect(onSwipeNext).toHaveBeenCalledTimes(1);

  fireEvent.touchStart(swipeContainer, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchEnd(swipeContainer, { changedTouches: [{ clientX: 200, clientY: 100 }] });
  expect(onSwipePrevious).toHaveBeenCalledTimes(1);
});
