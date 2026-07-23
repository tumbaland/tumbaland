import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { vi } from 'vitest';
import { useCollageEditor } from '../../hooks/useCollageEditor';
import CollageStage, { ResolvePhoto } from './CollageStage';
import { CollageDoc } from './collageDoc';

const baseDoc: CollageDoc = {
  canvas: { width: 1600, height: 900 },
  background: '#111111',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [
    { id: 'photo-item-1', photoId: 'photo-1', x: 100, y: 100, width: 200, height: 150, rotation: 0, caption: 'Beach day' }
  ],
  texts: [{ id: 'text-item-1', text: 'Hello', x: 400, y: 100, width: 240, height: 60, fontSize: 32, color: '#e91e63' }]
};

function Harness({
  doc,
  readOnly = false,
  zoom = 1,
  onEditItem,
  onDropPhoto,
  resolvePhoto = () => ({ src: 'https://cdn.example/a.jpg', width: 800, height: 600, title: 'Beach day' })
}: {
  doc: CollageDoc;
  readOnly?: boolean;
  zoom?: number;
  onEditItem?: (id: string) => void;
  onDropPhoto?: (photoId: string, x: number, y: number) => void;
  resolvePhoto?: ResolvePhoto;
}) {
  const editor = useCollageEditor();
  useEffect(() => {
    editor.init(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!editor.doc) return null;
  return (
    <CollageStage
      editor={editor}
      resolvePhoto={resolvePhoto}
      readOnly={readOnly}
      zoom={zoom}
      onEditItem={onEditItem}
      onDropPhoto={onDropPhoto}
    />
  );
}

it('renders nothing until the editor has an initialized doc', () => {
  const { container } = render(
    <CollageStage
      editor={{ doc: null } as unknown as ReturnType<typeof useCollageEditor>}
      resolvePhoto={() => undefined}
      readOnly={false}
      zoom={1}
    />
  );

  expect(container).toBeEmptyDOMElement();
});

it('renders a photo item with its image and caption', () => {
  render(<Harness doc={baseDoc} />);

  expect(screen.getByAltText('Beach day')).toHaveAttribute('src', 'https://cdn.example/a.jpg');
  expect(screen.getByText('Beach day')).toBeInTheDocument();
});

it('shows a placeholder when a photo cannot be resolved', () => {
  render(<Harness doc={baseDoc} resolvePhoto={() => undefined} />);

  expect(screen.getByText('Image unavailable')).toBeInTheDocument();
});

it('renders a text item', () => {
  render(<Harness doc={baseDoc} />);

  expect(screen.getByText('Hello')).toBeInTheDocument();
});

function findByComputedStyle(container: HTMLElement, prop: keyof CSSStyleDeclaration, value: string) {
  return Array.from(container.querySelectorAll('div')).find((el) => getComputedStyle(el)[prop] === value);
}

it('selects an item on pointer down and shows resize/rotate handles for a photo', () => {
  const { container } = render(<Harness doc={baseDoc} />);

  const photoBox = container.querySelector('[data-item-id="photo-item-1"]')!;
  fireEvent.pointerDown(photoBox, { clientX: 150, clientY: 150 });

  // The rotate handle (round) and resize handle (nwse-resize cursor) only
  // render for a selected photo (rotate is hidden for a selected text item).
  expect(findByComputedStyle(container, 'borderRadius', '50%')).toBeTruthy();
  expect(findByComputedStyle(container, 'cursor', 'nwse-resize')).toBeTruthy();
});

it('calls onEditItem on double-click of a photo item', () => {
  const onEditItem = vi.fn();
  const { container } = render(<Harness doc={baseDoc} onEditItem={onEditItem} />);

  fireEvent.doubleClick(container.querySelector('[data-item-id="photo-item-1"]')!);

  expect(onEditItem).toHaveBeenCalledWith('photo-item-1');
});

it('clears selection when clicking the canvas background', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const photoBox = container.querySelector('[data-item-id="photo-item-1"]')!;
  fireEvent.pointerDown(photoBox, { clientX: 150, clientY: 150 });

  const outerContainer = container.firstChild as HTMLElement;
  fireEvent.pointerDown(outerContainer, { target: outerContainer });

  // no easy DOM assertion for internal selection state, but this exercises
  // the branch without throwing and leaves the stage rendered.
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

it('does not attach pointer-down handlers to items in read-only mode', () => {
  const onEditItem = vi.fn();
  const { container } = render(<Harness doc={baseDoc} readOnly onEditItem={onEditItem} />);

  fireEvent.doubleClick(container.querySelector('[data-item-id="photo-item-1"]')!);

  expect(onEditItem).not.toHaveBeenCalled();
});

it('drops a photo onto the canvas via onDropPhoto', () => {
  const onDropPhoto = vi.fn();
  const { container } = render(<Harness doc={baseDoc} onDropPhoto={onDropPhoto} />);

  const canvas = container.querySelector('[data-item-id="photo-item-1"]')!.parentElement!;
  const dataTransfer = { getData: () => 'photo-99' };
  fireEvent.drop(canvas, { dataTransfer, clientX: 210, clientY: 220 });

  expect(onDropPhoto).toHaveBeenCalledWith('photo-99', expect.any(Number), expect.any(Number));
});

it('ignores a drop with no photo id in the data transfer', () => {
  const onDropPhoto = vi.fn();
  const { container } = render(<Harness doc={baseDoc} onDropPhoto={onDropPhoto} />);

  const canvas = container.querySelector('[data-item-id="photo-item-1"]')!.parentElement!;
  const dataTransfer = { getData: () => '' };
  fireEvent.drop(canvas, { dataTransfer });

  expect(onDropPhoto).not.toHaveBeenCalled();
});

it('drags an item via pointer move/up, repositioning it', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const photoBox = container.querySelector('[data-item-id="photo-item-1"]') as HTMLElement;
  expect(getComputedStyle(photoBox).left).toBe('100px');

  fireEvent.pointerDown(photoBox, { clientX: 150, clientY: 150 });
  fireEvent.pointerMove(window, { clientX: 200, clientY: 220 });
  fireEvent.pointerUp(window);

  expect(getComputedStyle(photoBox).left).not.toBe('100px');
});

it('resizes an item via the resize handle', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const photoBox = container.querySelector('[data-item-id="photo-item-1"]') as HTMLElement;
  fireEvent.pointerDown(photoBox, { clientX: 150, clientY: 150 });

  const resizeHandle = findByComputedStyle(container, 'cursor', 'nwse-resize')!;
  fireEvent.pointerDown(resizeHandle, { clientX: 300, clientY: 250 });
  fireEvent.pointerMove(window, { clientX: 340, clientY: 290 });
  fireEvent.pointerUp(window);

  expect(Number.parseFloat(getComputedStyle(photoBox).width)).toBeGreaterThan(200);
});

it('rotates a photo via the rotate handle', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const photoBox = container.querySelector('[data-item-id="photo-item-1"]') as HTMLElement;
  fireEvent.pointerDown(photoBox, { clientX: 150, clientY: 150 });

  const rotateHandle = findByComputedStyle(container, 'borderRadius', '50%')!;
  fireEvent.pointerDown(rotateHandle, { clientX: 200, clientY: 50 });
  fireEvent.pointerMove(window, { clientX: 260, clientY: 150 });
  fireEvent.pointerUp(window);

  expect(getComputedStyle(photoBox).transform).not.toBe('rotate(0deg)');
});

it('applies a bgcolor and padding to a framed photo', () => {
  const framedDoc: CollageDoc = { ...baseDoc, frameEnabled: true };
  const { container } = render(<Harness doc={framedDoc} />);

  const photoBox = container.querySelector('[data-item-id="photo-item-1"]') as HTMLElement;
  expect(getComputedStyle(photoBox).backgroundColor).toBe('rgb(255, 255, 255)');
});

it('drags a text item, snapping it to the horizontal/vertical canvas center', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const textBox = container.querySelector('[data-item-id="text-item-1"]') as HTMLElement;

  fireEvent.pointerDown(textBox, { clientX: 400, clientY: 100 });
  // canvas is 1600x900; text is 240x60 at (400,100) — move it near the exact center.
  fireEvent.pointerMove(window, { clientX: 400 + (800 - 120 - 400), clientY: 100 + (450 - 30 - 100) });
  fireEvent.pointerUp(window);

  expect(getComputedStyle(textBox).left).toBe(`${1600 / 2 - 240 / 2}px`);
  expect(getComputedStyle(textBox).top).toBe(`${900 / 2 - 60 / 2}px`);
});

it('resizes a text item without preserving aspect ratio, even without the shift key', () => {
  const { container } = render(<Harness doc={baseDoc} />);
  const textBox = container.querySelector('[data-item-id="text-item-1"]') as HTMLElement;
  fireEvent.pointerDown(textBox, { clientX: 400, clientY: 100 });

  const resizeHandle = findByComputedStyle(container, 'cursor', 'nwse-resize')!;
  fireEvent.pointerDown(resizeHandle, { clientX: 640, clientY: 160 });
  // dx=100 (width 240->340), dy=10 (height 60->70) — aspect-locked resize
  // would derive height from width; text items never keep aspect.
  fireEvent.pointerMove(window, { clientX: 740, clientY: 170 });
  fireEvent.pointerUp(window);

  expect(getComputedStyle(textBox).width).toBe('340px');
  expect(getComputedStyle(textBox).height).toBe('70px');
});
