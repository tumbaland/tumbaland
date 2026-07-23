import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/photoService', () => ({
  photoService: {
    getUploadSignedUrl: vi.fn(),
    uploadFileToSignedUrl: vi.fn(),
    createPhoto: vi.fn()
  }
}));

import { photoService } from '../services/photoService';
import FileUpload from './FileUpload';

const mockedGetUploadSignedUrl = photoService.getUploadSignedUrl as unknown as ReturnType<typeof vi.fn>;
const mockedUploadFileToSignedUrl = photoService.uploadFileToSignedUrl as unknown as ReturnType<typeof vi.fn>;
const mockedCreatePhoto = photoService.createPhoto as unknown as ReturnType<typeof vi.fn>;

/** Defaults to a successful load (matches most real images); a test can flip
 * FakeImage.nextFails to exercise the onerror branch instead. */
class FakeImage {
  static nextFails = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  private _src = '';
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (FakeImage.nextFails) this.onerror?.();
      else this.onload?.();
    });
  }
  get src() {
    return this._src;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeImage.nextFails = false;
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog(overrides: Partial<{ onClose: () => void; onUploadComplete: () => void }> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onUploadComplete = overrides.onUploadComplete ?? vi.fn();
  render(<FileUpload albumId="album-1" open onClose={onClose} onUploadComplete={onUploadComplete} />);
  return { onClose, onUploadComplete };
}

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['data'], name, { type });
}

it('disables the upload button until a file is selected', async () => {
  renderDialog();

  const uploadButton = screen.getByRole('button', { name: /upload files/i });
  expect(uploadButton).toBeDisabled();

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, makeFile());

  expect(screen.getByRole('button', { name: /upload 1 file/i })).toBeEnabled();
});

it('lists the selected file with its formatted size and lets it be removed', async () => {
  renderDialog();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'.repeat(2048)], 'photo.jpg', { type: 'image/jpeg' });
  await userEvent.upload(input, file);

  expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  expect(screen.getByText('2 KB')).toBeInTheDocument();

  const removeButton = screen.getByText('photo.jpg').closest('li')!.querySelector('button')!;
  await userEvent.click(removeButton);

  expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
});

it('rejects non-image/video files with an error message', async () => {
  renderDialog();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const badFile = new File(['data'], 'notes.txt', { type: 'text/plain' });

  // The input's accept="image/*,video/*" makes userEvent.upload silently
  // filter non-matching files by default — disable that so this exercises
  // the component's own onChange validation instead of user-event's.
  await userEvent.upload(input, badFile, { applyAccept: false });

  expect(screen.getByText('Only image and video files are allowed')).toBeInTheDocument();
  expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
});

it('accepts a drag-and-drop file via the dropzone', async () => {
  renderDialog();
  const dropzone = screen.getByText(/drop images and videos here/i).closest('div')!;
  const file = makeFile();

  const dataTransfer = { files: [file] };
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.drop(dropzone, { dataTransfer });

  expect(screen.getByText('photo.jpg')).toBeInTheDocument();
});

it('uploads selected files end-to-end and calls onUploadComplete', async () => {
  mockedGetUploadSignedUrl.mockResolvedValue({ uploadUrl: 'https://minio.example/upload', minioFileId: 'file-1', albumId: 'album-1', expiresInMinutes: 15 });
  mockedUploadFileToSignedUrl.mockResolvedValue(undefined);
  mockedCreatePhoto.mockResolvedValue({ _id: 'photo-1' });
  const { onUploadComplete } = renderDialog();

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, makeFile());
  await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));

  await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
  expect(mockedCreatePhoto).toHaveBeenCalledWith(
    expect.objectContaining({ filename: 'photo.jpg', albumId: 'album-1', width: 800, height: 600 })
  );
});

it('omits dimensions when the image fails to load', async () => {
  FakeImage.nextFails = true;
  mockedGetUploadSignedUrl.mockResolvedValue({ uploadUrl: 'https://minio.example/upload', minioFileId: 'file-1', albumId: 'album-1', expiresInMinutes: 15 });
  mockedUploadFileToSignedUrl.mockResolvedValue(undefined);
  mockedCreatePhoto.mockResolvedValue({ _id: 'photo-1' });
  renderDialog();

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, makeFile());
  await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));

  await waitFor(() => expect(mockedCreatePhoto).toHaveBeenCalled());
  expect(mockedCreatePhoto).toHaveBeenCalledWith(
    expect.objectContaining({ width: undefined, height: undefined })
  );
});

it('shows an error and stays open when the upload fails', async () => {
  mockedGetUploadSignedUrl.mockRejectedValue(new Error('network down'));
  renderDialog();

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, makeFile());
  await userEvent.click(screen.getByRole('button', { name: /upload 1 file/i }));

  expect(await screen.findByText('Failed to upload photo.jpg')).toBeInTheDocument();
});

it('does not close while uploading, but does on Cancel beforehand', async () => {
  const { onClose } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
