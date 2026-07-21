import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoViewer from './PhotoViewer';
import { makePhoto } from '../test/fixtures';

vi.mock('../utils/downloadPhoto', () => ({ downloadPhoto: vi.fn() }));
import { downloadPhoto } from '../utils/downloadPhoto';

const photos = [
  makePhoto({ _id: 'p1', title: 'First', thumbnailUrl: '/p1-thumb.jpg', signedUrl: '/p1-full.jpg' }),
  makePhoto({ _id: 'p2', title: 'Second', thumbnailUrl: '/p2-thumb.jpg', signedUrl: '/p2-full.jpg' }),
  makePhoto({ _id: 'p3', title: 'Third', thumbnailUrl: '/p3-thumb.jpg', signedUrl: '/p3-full.jpg' })
];

function renderViewer(overrides: Partial<React.ComponentProps<typeof PhotoViewer>> = {}) {
  const onClose = vi.fn();
  const onPrevious = vi.fn();
  const onNext = vi.fn();
  const utils = render(
    <PhotoViewer
      photos={photos}
      selectedPhoto={photos[1]}
      selectedPhotoIndex={1}
      open
      onClose={onClose}
      onPrevious={onPrevious}
      onNext={onNext}
      {...overrides}
    />
  );
  return { ...utils, onClose, onPrevious, onNext };
}

it('renders nothing when there is no selected photo', () => {
  const { container } = render(
    <PhotoViewer photos={photos} selectedPhoto={null} selectedPhotoIndex={0} open onClose={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
});

it('shows the photo, alt text, and position counter', () => {
  renderViewer();
  const img = screen.getByRole('img') as HTMLImageElement;
  expect(img.alt).toBe('Second');
  expect(screen.getByText('2 of 3')).toBeInTheDocument();
});

it('renders a video element with controls for a video photo', () => {
  const video = makePhoto({ _id: 'v1', mimetype: 'video/mp4', signedUrl: '/clip.mp4' });
  renderViewer({ selectedPhoto: video, photos: [video], selectedPhotoIndex: 0 });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(document.querySelector('video')).toBeInTheDocument();
});

it('hides Previous on the first photo and Next on the last', () => {
  const { rerender } = renderViewer({ selectedPhoto: photos[0], selectedPhotoIndex: 0 });
  expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();

  rerender(
    <PhotoViewer photos={photos} selectedPhoto={photos[2]} selectedPhotoIndex={2} open onClose={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />
  );
  // Buttons have no accessible name, so just count icon buttons via test id instead.
  expect(document.querySelector('[data-testid="NavigateNextIcon"]')).not.toBeInTheDocument();
});

it('calls onPrevious and onNext from the nav buttons', async () => {
  const { onPrevious, onNext } = renderViewer();

  await userEvent.click(document.querySelector('[data-testid="NavigateBeforeIcon"]')!.closest('button')!);
  expect(onPrevious).toHaveBeenCalledTimes(1);

  await userEvent.click(document.querySelector('[data-testid="NavigateNextIcon"]')!.closest('button')!);
  expect(onNext).toHaveBeenCalledTimes(1);
});

it('calls onClose from the close button and the background overlay', async () => {
  const { onClose } = renderViewer();

  await userEvent.click(document.querySelector('[data-testid="CloseIcon"]')!.closest('button')!);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('calls downloadPhoto with the selected photo when the download button is clicked', async () => {
  renderViewer();
  await userEvent.click(document.querySelector('[data-testid="DownloadIcon"]')!.closest('button')!);
  expect(downloadPhoto).toHaveBeenCalledWith(photos[1]);
});

it('navigates with the left/right arrow keys and closes on Escape while open', () => {
  const { onPrevious, onNext, onClose } = renderViewer();

  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(onNext).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(document, { key: 'ArrowLeft' });
  expect(onPrevious).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('ignores keyboard navigation while closed', () => {
  const { onNext } = renderViewer({ open: false });
  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(onNext).not.toHaveBeenCalled();
});

it('navigates via left/right/middle click zones on the image', () => {
  const { onPrevious, onNext } = renderViewer();
  const img = screen.getByRole('img');
  vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);

  fireEvent.click(img, { clientX: 50 }); // left third
  expect(onPrevious).toHaveBeenCalledTimes(1);

  fireEvent.click(img, { clientX: 250 }); // right third
  expect(onNext).toHaveBeenCalledTimes(1);

  fireEvent.click(img, { clientX: 150 }); // middle — neither
  expect(onPrevious).toHaveBeenCalledTimes(1);
  expect(onNext).toHaveBeenCalledTimes(1);
});

it('does not navigate past the ends via click zones', () => {
  const { onPrevious } = renderViewer({ selectedPhoto: photos[0], selectedPhotoIndex: 0 });
  const img = screen.getByRole('img');
  vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 300 } as DOMRect);

  fireEvent.click(img, { clientX: 50 }); // left third, but already the first photo
  expect(onPrevious).not.toHaveBeenCalled();
});
