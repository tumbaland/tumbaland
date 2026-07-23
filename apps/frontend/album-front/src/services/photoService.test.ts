import { vi } from 'vitest';
import { photoService } from './photoService';
import { makePhoto } from '../test/fixtures';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

it('creates a photo and unwraps the data envelope', async () => {
  const photo = makePhoto();
  mockFetchOnce({ success: true, data: photo });

  const result = await photoService.createPhoto({
    filename: photo.filename,
    originalName: photo.originalName,
    minioFileId: 'file-1',
    albumId: photo.albumId,
    mimetype: photo.mimetype,
    size: photo.size
  });

  expect(result).toEqual(photo);
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(init).toMatchObject({ method: 'POST' });
});

it('fetches photos by album with pagination params', async () => {
  mockFetchOnce({ success: true, data: { photos: [makePhoto()], pagination: { page: 1, limit: 10, total: 1, pages: 1 } } });

  await photoService.getPhotosByAlbum('album-1', { page: 1, limit: 10 });

  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/photos/album/album-1?page=1&limit=10');
});

it('fetches a photo by id', async () => {
  const photo = makePhoto();
  mockFetchOnce({ success: true, data: photo });

  const result = await photoService.getPhotoById('photo-1');

  expect(result).toEqual(photo);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/photos/photo-1');
});

it('updates a photo', async () => {
  const photo = makePhoto({ title: 'New title' });
  mockFetchOnce({ success: true, data: photo });

  const result = await photoService.updatePhoto('photo-1', { title: 'New title' });

  expect(result.title).toBe('New title');
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify({ title: 'New title' }) });
});

it('deletes a photo', async () => {
  mockFetchOnce({ success: true });

  await photoService.deletePhoto('photo-1');

  const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/photos/photo-1');
  expect(init).toMatchObject({ method: 'DELETE' });
});

it('gets an upload signed url', async () => {
  mockFetchOnce({
    success: true,
    data: { uploadUrl: 'https://minio.example/upload', minioFileId: 'file-1', albumId: 'album-1', expiresInMinutes: 15 }
  });

  const result = await photoService.getUploadSignedUrl('photo.jpg', 'image/jpeg', 'album-1');

  expect(result).toMatchObject({ uploadUrl: 'https://minio.example/upload', expiresInMinutes: 15 });
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(init).toMatchObject({
    method: 'POST',
    body: JSON.stringify({ filename: 'photo.jpg', mimetype: 'image/jpeg', albumId: 'album-1' })
  });
});

it('updates AI analysis metadata for a photo', async () => {
  const photo = makePhoto();
  mockFetchOnce({ success: true, data: photo });

  await photoService.updatePhotoAIAnalysis('photo-1', {
    analysisType: 'objectDetection',
    resultId: 'result-1',
    totalDetections: 3,
    processingTime: 1200
  });

  const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/photos/photo-1/ai-analysis');
  expect(init).toMatchObject({ method: 'PUT' });
});

describe('uploadFileToSignedUrl', () => {
  it('PUTs the file to the signed URL with its content type', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

    await photoService.uploadFileToSignedUrl('https://minio.example/upload?sig=abc', file);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://minio.example/upload?sig=abc',
      expect.objectContaining({ method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } })
    );
  });

  it('throws when the upload response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

    await expect(photoService.uploadFileToSignedUrl('https://minio.example/upload', file)).rejects.toThrow(
      'File upload failed with status 500'
    );
  });
});

describe('loadPhotosWithThumbnails', () => {
  it('maps signed URLs onto thumbnailUrl/fileUrl and passes through pagination', async () => {
    const photo = makePhoto({ signedUrl: 'https://cdn.example/full.jpg', thumbnailSignedUrl: 'https://cdn.example/thumb.jpg' });
    mockFetchOnce({
      success: true,
      data: { photos: [photo], pagination: { page: 1, limit: 10, total: 1, pages: 1 } }
    });

    const result = await photoService.loadPhotosWithThumbnails('album-1');

    expect(result.photos[0]).toMatchObject({
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      fileUrl: 'https://cdn.example/full.jpg'
    });
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  it('leaves thumbnailUrl undefined when there is no thumbnail signed URL', async () => {
    const photo = makePhoto({ signedUrl: 'https://cdn.example/full.jpg' });
    mockFetchOnce({
      success: true,
      data: { photos: [photo], pagination: { page: 1, limit: 10, total: 1, pages: 1 } }
    });

    const result = await photoService.loadPhotosWithThumbnails('album-1');

    expect(result.photos[0].thumbnailUrl).toBeUndefined();
    expect(result.photos[0].fileUrl).toBe('https://cdn.example/full.jpg');
  });

  it('defaults to an empty photos array when the response omits it', async () => {
    mockFetchOnce({ success: true, data: { pagination: { page: 1, limit: 10, total: 0, pages: 0 } } });

    const result = await photoService.loadPhotosWithThumbnails('album-1');

    expect(result.photos).toEqual([]);
  });
});
