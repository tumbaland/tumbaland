import { renderHook, act } from '@testing-library/react';
import { useProgressiveImage } from './useProgressiveImage';

class FakeImage {
  static instances: FakeImage[] = [];
  static startComplete = false;
  onload: (() => void) | null = null;
  complete = false;
  src = '';

  constructor() {
    this.complete = FakeImage.startComplete;
    FakeImage.instances.push(this);
  }
}

beforeEach(() => {
  FakeImage.instances = [];
  FakeImage.startComplete = false;
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('shows the thumbnail until the full image finishes loading', () => {
  const { result } = renderHook(() => useProgressiveImage('/full.jpg', '/thumb.jpg'));

  expect(result.current.displaySrc).toBe('/thumb.jpg');
  expect(result.current.isFullLoaded).toBe(false);

  act(() => {
    FakeImage.instances[0].onload?.();
  });

  expect(result.current.displaySrc).toBe('/full.jpg');
  expect(result.current.isFullLoaded).toBe(true);
});

it('goes straight to the full image when there is no thumbnail', () => {
  const { result } = renderHook(() => useProgressiveImage('/full.jpg', undefined));
  expect(result.current.displaySrc).toBe('/full.jpg');
});

it('reports loaded immediately if the image is already cached (img.complete)', () => {
  FakeImage.startComplete = true;
  const { result } = renderHook(() => useProgressiveImage('/full.jpg', '/thumb.jpg'));

  expect(result.current.isFullLoaded).toBe(true);
  expect(result.current.displaySrc).toBe('/full.jpg');
});

it('has no display source when there is no full src', () => {
  const { result } = renderHook(() => useProgressiveImage(undefined, undefined));
  expect(result.current.displaySrc).toBeUndefined();
  expect(result.current.isFullLoaded).toBe(false);
});

it('resets isFullLoaded and re-preloads when fullSrc changes', () => {
  const { result, rerender } = renderHook(({ fullSrc, thumbnailSrc }) => useProgressiveImage(fullSrc, thumbnailSrc), {
    initialProps: { fullSrc: '/a.jpg', thumbnailSrc: '/a-thumb.jpg' }
  });

  act(() => {
    FakeImage.instances[0].onload?.();
  });
  expect(result.current.isFullLoaded).toBe(true);

  rerender({ fullSrc: '/b.jpg', thumbnailSrc: '/b-thumb.jpg' });

  expect(result.current.isFullLoaded).toBe(false);
  expect(result.current.displaySrc).toBe('/b-thumb.jpg');
});
