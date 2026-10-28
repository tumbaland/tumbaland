import { downloadPhoto } from './downloadPhoto';
import { Photo } from '../types';

vi.mock('@tumbaland/frontend-core', () => ({
  downloadBlob: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import { downloadBlob, logger } from '@tumbaland/frontend-core';

function makePhoto(overrides: Partial<Photo> = {}): Pick<Photo, 'signedUrl' | 'originalName' | '_id' | 'mimetype'> {
  return {
    _id: 'p1',
    signedUrl: 'https://example.com/photo.jpg',
    originalName: 'photo.jpg',
    mimetype: 'image/jpeg',
    ...overrides
  };
}

const fakeBlob = { type: 'image/jpeg' } as Blob;

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error test-only cleanup of a Navigator extension not in the base lib types
  delete navigator.canShare;
  // @ts-expect-error test-only cleanup of a Navigator extension not in the base lib types
  delete navigator.share;
});

it('does nothing when the photo has no signedUrl', async () => {
  await downloadPhoto(makePhoto({ signedUrl: undefined }));
  expect(fetch).not.toHaveBeenCalled();
});

it('shares the file via the Web Share API when file sharing is supported', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });

  await downloadPhoto(makePhoto());

  expect(share).toHaveBeenCalledTimes(1);
  const sharedFiles = share.mock.calls[0][0].files;
  expect(sharedFiles).toHaveLength(1);
  expect(sharedFiles[0].name).toBe('photo.jpg');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('treats the user cancelling the share sheet as a no-op, not a failure', async () => {
  const abortError = new DOMException('cancelled', 'AbortError');
  const share = vi.fn().mockRejectedValue(abortError);
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });

  await downloadPhoto(makePhoto());

  expect(logger.error).not.toHaveBeenCalled();
  expect(window.open).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('falls back to the blob-download link when file sharing is unsupported', async () => {
  vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });

  await downloadPhoto(makePhoto());

  expect(downloadBlob).toHaveBeenCalledWith(fakeBlob, 'photo.jpg');
});

it('falls back to opening the URL directly when the fetch fails', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
  vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined });

  const photo = makePhoto();
  await downloadPhoto(photo);

  expect(logger.error).toHaveBeenCalledWith('Download failed', expect.any(Error));
  expect(window.open).toHaveBeenCalledWith(photo.signedUrl, '_blank');
});

it('falls back to opening the URL directly when a non-cancel share error occurs', async () => {
  const share = vi.fn().mockRejectedValue(new Error('share failed'));
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });

  const photo = makePhoto();
  await downloadPhoto(photo);

  expect(logger.error).toHaveBeenCalledWith('Download failed', expect.any(Error));
  expect(window.open).toHaveBeenCalledWith(photo.signedUrl, '_blank');
});
