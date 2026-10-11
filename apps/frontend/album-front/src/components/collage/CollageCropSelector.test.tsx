import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vite-plus/test';
import CollageCropSelector from './CollageCropSelector';
import { CollageCrop } from '@tumbaland/collage-core';

/** jsdom gives every element a zero-sized box, so the preview needs a fake one. */
const PREVIEW_SIZE = { width: 200, height: 100 };

function sizeSurface() {
  const surface = screen.getByTestId('crop-surface');
  Object.defineProperty(surface, 'offsetWidth', { value: PREVIEW_SIZE.width, configurable: true });
  Object.defineProperty(surface, 'offsetHeight', { value: PREVIEW_SIZE.height, configurable: true });
  surface.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: PREVIEW_SIZE.width, height: PREVIEW_SIZE.height }) as DOMRect;
  return surface;
}

/** Controlled wrapper, since the selector reports every change to its parent. */
function Harness({
  initialCrop,
  rotation = 0,
  orientation
}: {
  initialCrop?: CollageCrop;
  rotation?: number;
  orientation?: number;
}) {
  const [crop, setCrop] = useState<CollageCrop | undefined>(initialCrop);
  return (
    <>
      <CollageCropSelector
        src="https://cdn.example/a.jpg"
        rotation={rotation}
        orientation={orientation}
        crop={crop}
        onChange={setCrop}
      />
      <output data-testid="crop-value">{crop ? `${crop.x},${crop.y},${crop.width},${crop.height}` : 'none'}</output>
    </>
  );
}

const cropValue = () => screen.getByTestId('crop-value').textContent;

/** Compares the reported crop numerically; the drag math is float arithmetic. */
function expectCrop(x: number, y: number, width: number, height: number) {
  const value = cropValue();
  expect(value).not.toBe('none');
  const [ax, ay, aw, ah] = (value as string).split(',').map(Number);
  expect(ax).toBeCloseTo(x);
  expect(ay).toBeCloseTo(y);
  expect(aw).toBeCloseTo(width);
  expect(ah).toBeCloseTo(height);
}

it('draws a crop from a drag across the preview', () => {
  render(<Harness />);
  const surface = sizeSurface();

  fireEvent.pointerDown(surface, { clientX: 40, clientY: 20 });
  fireEvent.pointerMove(surface, { clientX: 140, clientY: 70 });
  fireEvent.pointerUp(surface);

  // 40..140 of 200 wide, 20..70 of 100 tall
  expectCrop(0.2, 0.2, 0.5, 0.5);
  expect(screen.getByTestId('crop-region')).toBeInTheDocument();
});

it('normalizes a drag that runs right-to-left and upwards', () => {
  render(<Harness />);
  const surface = sizeSurface();

  fireEvent.pointerDown(surface, { clientX: 140, clientY: 70 });
  fireEvent.pointerMove(surface, { clientX: 40, clientY: 20 });
  fireEvent.pointerUp(surface);

  expectCrop(0.2, 0.2, 0.5, 0.5);
});

it('rolls back to the previous crop when the drag is too small to be a selection', () => {
  const existing = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
  render(<Harness initialCrop={existing} />);
  const surface = sizeSurface();

  fireEvent.pointerDown(surface, { clientX: 4, clientY: 4 });
  fireEvent.pointerMove(surface, { clientX: 5, clientY: 5 });
  fireEvent.pointerUp(surface);

  expectCrop(0.1, 0.1, 0.5, 0.5);
});

it('clears the crop when a stray click starts from no selection', () => {
  render(<Harness />);
  const surface = sizeSurface();

  fireEvent.pointerDown(surface, { clientX: 20, clientY: 20 });
  fireEvent.pointerUp(surface);

  expect(cropValue()).toBe('none');
});

it('moves an existing crop when dragging inside it', () => {
  render(<Harness initialCrop={{ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }} />);
  const surface = sizeSurface();

  // pointerdown on the region itself, then 20px right and 10px down
  fireEvent.pointerDown(screen.getByTestId('crop-region'), { clientX: 40, clientY: 20 });
  fireEvent.pointerMove(surface, { clientX: 60, clientY: 30 });
  fireEvent.pointerUp(surface);

  expectCrop(0.2, 0.2, 0.4, 0.4);
});

it('keeps a moved crop inside the image', () => {
  render(<Harness initialCrop={{ x: 0.5, y: 0.5, width: 0.5, height: 0.5 }} />);
  const surface = sizeSurface();

  fireEvent.pointerDown(screen.getByTestId('crop-region'), { clientX: 150, clientY: 75 });
  fireEvent.pointerMove(surface, { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(surface);

  expectCrop(0.5, 0.5, 0.5, 0.5);
});

it('resizes the crop from the corner handle', () => {
  render(<Harness initialCrop={{ x: 0.1, y: 0.1, width: 0.4, height: 0.4 }} />);
  const surface = sizeSurface();

  fireEvent.pointerDown(screen.getByTestId('crop-handle'), { clientX: 100, clientY: 50 });
  fireEvent.pointerMove(surface, { clientX: 180, clientY: 90 });
  fireEvent.pointerUp(surface);

  // handle drags the bottom-right corner to 0.9 / 0.9, from an origin at 0.1
  expectCrop(0.1, 0.1, 0.8, 0.8);
});

it('measures the drag in the image’s own space when the preview is rotated', () => {
  render(<Harness rotation={90} />);
  const surface = sizeSurface();

  // on a 90° preview, screen-down is image-left: the drag lands on a region
  // that is 20% wide and 40% tall, not the 20%x40% box the screen shows
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 50 });
  fireEvent.pointerMove(surface, { clientX: 140, clientY: 90 });
  fireEvent.pointerUp(surface);

  expectCrop(0.5, 0.1, 0.2, 0.4);
});

it('reports the natural size once the preview loads', () => {
  const onNaturalSize = vi.fn();
  render(
    <CollageCropSelector
      src="https://cdn.example/a.jpg"
      rotation={0}
      onChange={vi.fn()}
      onNaturalSize={onNaturalSize}
    />
  );

  const img = screen.getByRole('img', { name: 'preview' });
  Object.defineProperty(img, 'naturalWidth', { value: 1600, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: 900, configurable: true });
  fireEvent.load(img);

  expect(onNaturalSize).toHaveBeenCalledWith({ width: 1600, height: 900 });
});

it('ignores pointer moves that did not start with a pointer down', () => {
  render(<Harness />);
  const surface = sizeSurface();

  fireEvent.pointerMove(surface, { clientX: 140, clientY: 70 });

  expect(cropValue()).toBe('none');
});

/** Loads the preview at a known natural size so the oriented layout kicks in. */
function loadPreview(width: number, height: number) {
  const img = screen.getByRole('img', { name: 'preview' });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(img);
  return img;
}

it('lays the preview out at the oriented aspect ratio', () => {
  render(<CollageCropSelector src="https://cdn.example/a.jpg" rotation={0} orientation={90} onChange={vi.fn()} />);

  // a 440x220 photo on its side is 220x440, halved to fit the 220px-tall box
  const img = loadPreview(440, 220);

  expect(screen.getByTestId('crop-preview')).toHaveStyle({ width: '110px', height: '220px' });
  // the image itself keeps its own 2:1 footprint underneath the turn
  expect(img).toHaveStyle({ width: '220px', height: '110px', transform: 'rotate(90deg)' });
});

it('keeps the preview at its own aspect ratio when the photo is upright', () => {
  render(<CollageCropSelector src="https://cdn.example/a.jpg" rotation={0} onChange={vi.fn()} />);

  const img = loadPreview(600, 300);

  expect(screen.getByTestId('crop-preview')).toHaveStyle({ width: '340px', height: '170px' });
  expect(img).toHaveStyle({ transform: 'rotate(0deg)' });
});

it('measures the crop against the oriented preview, not the source image', () => {
  render(<Harness orientation={90} />);
  loadPreview(600, 300);
  const surface = sizeSurface();

  // the surface is 200x100 here, and the drag covers its left half
  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(surface, { clientX: 100, clientY: 100 });
  fireEvent.pointerUp(surface);

  expectCrop(0, 0, 0.5, 1);
});
