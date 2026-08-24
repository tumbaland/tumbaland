import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CollagePhotoDialog from './CollagePhotoDialog';
import { CollagePhotoItem } from './collageDoc';

const photo: CollagePhotoItem = {
  id: 'photo-1',
  photoId: 'p1',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  caption: 'Original caption'
};

it('prefills the caption and rotation from the given item', () => {
  render(<CollagePhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByDisplayValue('Original caption')).toBeInTheDocument();
  expect(screen.getByText('Rotation: 0°')).toBeInTheDocument();
});

it('shows "Use collage setting" when frame is undefined (inherit)', () => {
  render(<CollagePhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Use collage setting')).toBeInTheDocument();
});

it('shows "Always framed" when frame is explicitly true', () => {
  render(<CollagePhotoDialog open photo={{ ...photo, frame: true }} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Always framed')).toBeInTheDocument();
});

it('shows "Never framed" when frame is explicitly false', () => {
  render(<CollagePhotoDialog open photo={{ ...photo, frame: false }} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText('Never framed')).toBeInTheDocument();
});

it('renders the preview image with the current rotation when photoSrc is given', () => {
  render(
    <CollagePhotoDialog
      open
      photo={{ ...photo, rotation: 45 }}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByRole('img', { name: 'preview' })).toHaveAttribute('src', 'https://cdn.example/photo.jpg');
  // the item's tilt is carried by the preview wrapper, so the crop overlay tilts with it
  expect(screen.getByTestId('crop-preview')).toHaveStyle({ transform: 'rotate(45deg)' });
});

it('omits the preview image when there is no photoSrc', () => {
  render(<CollagePhotoDialog open photo={photo} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('saves the trimmed caption, rotation, and resolved frame value, then closes', async () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={{ ...photo, caption: '  padded  ' }}
      onClose={onClose}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onSave).toHaveBeenCalledWith({ caption: 'padded', rotation: 0, frame: undefined });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('calls onDelete then onClose when removing from the collage', async () => {
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(<CollagePhotoDialog open photo={photo} onClose={onClose} onSave={vi.fn()} onDelete={onDelete} />);

  await userEvent.click(screen.getByRole('button', { name: /remove from collage/i }));

  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('updates the rotation via the slider and reflects it in the preview + saved patch', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  fireEvent.change(screen.getByRole('slider'), { target: { value: 90 } });

  expect(screen.getByText('Rotation: 90°')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rotation: 90 }));
});

it('changes the frame setting via the select and saves the resolved boolean', async () => {
  const onSave = vi.fn();
  render(<CollagePhotoDialog open photo={photo} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);

  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: 'Always framed' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ frame: true }));
});

it('closes without saving on Cancel', async () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<CollagePhotoDialog open photo={photo} onClose={onClose} onSave={onSave} onDelete={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps an existing crop and reports it in the summary', () => {
  render(
    <CollagePhotoDialog
      open
      photo={{ ...photo, crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.25 } }}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByText('Showing 50% × 25% of the photo')).toBeInTheDocument();
  expect(screen.getByTestId('crop-region')).toBeInTheDocument();
});

it('invites a crop when the photo has none', () => {
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByText('Drag on the photo to crop it')).toBeInTheDocument();
  expect(screen.queryByTestId('crop-region')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Clear crop' })).toBeDisabled();
});

it('clears an existing crop and reshapes the box back to the full image', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={{ ...photo, crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.25 } }}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  const img = screen.getByRole('img', { name: 'preview' });
  Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: 400, configurable: true });
  fireEvent.load(img);

  await userEvent.click(screen.getByRole('button', { name: 'Clear crop' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  // whole image is 2:1, so the 100-wide box becomes 50 tall
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ crop: undefined, height: 50 }));
});

it('saves a crop drawn on the preview and matches the box to its shape', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  const img = screen.getByRole('img', { name: 'preview' });
  Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: 800, configurable: true });
  fireEvent.load(img);

  const surface = screen.getByTestId('crop-surface');
  Object.defineProperty(surface, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(surface, 'offsetHeight', { value: 200, configurable: true });
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;

  fireEvent.pointerDown(surface, { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(surface, { clientX: 100, clientY: 50 });
  fireEvent.pointerUp(surface);

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  const patch = onSave.mock.calls[0][0];
  expect(patch.crop.x).toBeCloseTo(0);
  expect(patch.crop.width).toBeCloseTo(0.5);
  expect(patch.crop.height).toBeCloseTo(0.25);
  // square source, so a 2:1 region on a 100-wide box is 50 tall
  expect(patch.height).toBeCloseTo(50);
});

it('leaves the box height alone when only the caption changed', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  fireEvent.load(screen.getByRole('img', { name: 'preview' }));
  await userEvent.type(screen.getByDisplayValue('Original caption'), '!');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  expect(onSave).toHaveBeenCalledWith({
    caption: 'Original caption!',
    rotation: 0,
    frame: undefined,
    crop: undefined
  });
});

it('turns the picture a quarter clockwise and saves it as an orientation', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Rotate right' }));

  expect(screen.getByText('Turned 90°')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'preview' })).toHaveStyle({ transform: 'rotate(90deg)' });

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ orientation: 90 }));
});

it('reaches 180° by rotating twice and wraps back to upright on the fourth turn', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  const rotateRight = screen.getByRole('button', { name: 'Rotate right' });
  await userEvent.click(rotateRight);
  await userEvent.click(rotateRight);
  expect(screen.getByText('Turned 180°')).toBeInTheDocument();

  await userEvent.click(rotateRight);
  await userEvent.click(rotateRight);
  expect(screen.getByText('Upright')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ orientation: undefined }));
});

it('rotates counter-clockwise into 270°', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Rotate left' }));

  expect(screen.getByText('Turned 270°')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ orientation: 270 }));
});

it('prefills the stored orientation and offers to reset it', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={{ ...photo, orientation: 180 }}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByText('Turned 180°')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByText('Upright')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ orientation: undefined }));
});

it('carries an existing crop through a quarter turn so it frames the same spot', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      // top-left quarter of the picture
      photo={{ ...photo, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  await userEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  // turning the picture clockwise moves its top-left quarter to the top-right
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      orientation: 90,
      crop: { x: 0.5, y: 0, width: 0.5, height: 0.5 }
    })
  );
});

it('reshapes the box to the turned photo even when the crop is untouched', async () => {
  const onSave = vi.fn();
  render(
    <CollagePhotoDialog
      open
      photo={photo}
      photoSrc="https://cdn.example/photo.jpg"
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
    />
  );

  const img = screen.getByRole('img', { name: 'preview' });
  Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: 400, configurable: true });
  fireEvent.load(img);

  await userEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  // a 2:1 photo on its side is 1:2, so the 100-wide box becomes 200 tall
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ orientation: 90, height: 200 }));
});
