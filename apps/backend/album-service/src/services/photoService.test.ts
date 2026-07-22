jest.mock('../models/Photo', () => {
  const ctor: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'new-photo-id',
    save: jest.fn().mockResolvedValue({ ...data, _id: 'new-photo-id' })
  }));
  ctor.findById = jest.fn();
  ctor.findOne = jest.fn();
  ctor.find = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Album', () => ({
  __esModule: true,
  default: { findById: jest.fn(), findOne: jest.fn() }
}));

jest.mock('./fileServiceClient', () => ({
  deleteFile: jest.fn(),
  getPhotoSignedUrl: jest.fn(),
  getPhotoSignedUrlsBatch: jest.fn(),
  getFile: jest.fn()
}));

jest.mock('./thumbnailService', () => ({
  generateThumbnailFromBuffer: jest.fn(),
  isSupportedImageFormat: jest.fn()
}));

import Photo from '../models/Photo';
import Album from '../models/Album';
import {
  deleteFile,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getFile
} from './fileServiceClient';
import { generateThumbnailFromBuffer, isSupportedImageFormat } from './thumbnailService';
import photoService from './photoService';

const mockedFindById = Photo.findById as unknown as jest.Mock;
const mockedFindOne = Photo.findOne as unknown as jest.Mock;
const mockedFind = Photo.find as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Photo.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Photo.findByIdAndDelete as unknown as jest.Mock;
const mockedAlbumFindById = Album.findById as unknown as jest.Mock;
const mockedAlbumFindOne = Album.findOne as unknown as jest.Mock;
const mockedDeleteFile = deleteFile as unknown as jest.Mock;
const mockedGetPhotoSignedUrl = getPhotoSignedUrl as unknown as jest.Mock;
const mockedGetPhotoSignedUrlsBatch = getPhotoSignedUrlsBatch as unknown as jest.Mock;
const mockedGetFile = getFile as unknown as jest.Mock;
const mockedGenerateThumbnail = generateThumbnailFromBuffer as unknown as jest.Mock;
const mockedIsSupported = isSupportedImageFormat as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('createPhoto', () => {
  const baseInput = { filename: 'x.jpg', originalName: 'x.jpg', minioFileId: 'file-1', albumId: 'a1', mimetype: 'image/jpeg', size: 100 };

  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    await expect(photoService.createPhoto(baseInput, 'user-1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws ConflictError when a photo with the same minioFileId already exists', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', coverPhotoId: 'existing' });
    mockedFindOne.mockResolvedValue({ _id: 'other-photo' });

    await expect(photoService.createPhoto(baseInput, 'user-1')).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('creates the photo and sets it as the album cover when none is set', async () => {
    const album: any = { _id: 'a1', coverPhotoId: undefined, save: jest.fn().mockResolvedValue(undefined) };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(false);

    const result = await photoService.createPhoto(baseInput, 'user-1');

    expect(result._id).toBe('new-photo-id');
    expect(album.coverPhotoId).toBe('new-photo-id');
    expect(album.save).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an existing album cover', async () => {
    const album: any = { _id: 'a1', coverPhotoId: 'existing-cover', save: jest.fn() };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(false);

    await photoService.createPhoto(baseInput, 'user-1');

    expect(album.coverPhotoId).toBe('existing-cover');
    expect(album.save).not.toHaveBeenCalled();
  });

  it('kicks off async thumbnail generation for supported image formats', async () => {
    const album: any = { _id: 'a1', coverPhotoId: 'x', save: jest.fn() };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(true);
    mockedGetFile.mockResolvedValue(Buffer.from('img'));
    mockedGenerateThumbnail.mockResolvedValue({ thumbnailFileId: 'thumb-1' });
    mockedFindByIdAndUpdate.mockResolvedValue({});

    await photoService.createPhoto(baseInput, 'user-1', 'group-1');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedGetFile).toHaveBeenCalledWith('file-1');
    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('new-photo-id', { minioThumbnailFileId: 'thumb-1' });
  });

  it('logs (does not throw) when async thumbnail generation fails', async () => {
    const album: any = { _id: 'a1', coverPhotoId: 'x', save: jest.fn() };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(true);
    mockedGetFile.mockRejectedValue(new Error('download failed'));

    await expect(photoService.createPhoto(baseInput, 'user-1')).resolves.toBeDefined();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('getPhotosByAlbum', () => {
  function chainable(result: any[]) {
    const query: any = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis() };
    query.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return query;
  }

  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    await expect(photoService.getPhotosByAlbum('a1', {})).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns paginated photos with signed URLs', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1' });
    const photo = { minioFileId: 'file-1', minioThumbnailFileId: undefined, toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({ 'file-1': { signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 } });

    const result = await photoService.getPhotosByAlbum('a1', { page: 1, limit: 10 });

    expect(result.photos[0]).toMatchObject({ signedUrl: 'https://x' });
    expect(result.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('continues (empty signed URL map) when the batch signed-url call fails', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1' });
    const photo = { minioFileId: 'file-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch.mockRejectedValue(new Error('down'));

    const result = await photoService.getPhotosByAlbum('a1', {});
    expect(result.photos[0].signedUrl).toBeUndefined();
  });

  it('also fetches thumbnail signed URLs for photos that have a thumbnail', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1' });
    const photo = { minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch
      .mockResolvedValueOnce({ 'file-1': { signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 } })
      .mockResolvedValueOnce({ 'file-1': { signedUrl: 'https://thumb', expiresAt: 't', expiresInMinutes: 60 } });

    const result = await photoService.getPhotosByAlbum('a1', {});
    expect(result.photos[0].thumbnailSignedUrl).toBe('https://thumb');
  });
});

describe('getPhotoById', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(photoService.getPhotoById('p1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the photo enriched with a signed URL', async () => {
    const photo = { minioFileId: 'file-1', minioThumbnailFileId: undefined, toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl.mockResolvedValue({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 });

    const result = await photoService.getPhotoById('p1');
    expect(result.signedUrl).toBe('https://x');
  });

  it('also enriches with a thumbnail signed URL when one exists', async () => {
    const photo = { minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl
      .mockResolvedValueOnce({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 })
      .mockResolvedValueOnce({ signedUrl: 'https://thumb', expiresAt: 't', expiresInMinutes: 60 });

    const result = await photoService.getPhotoById('p1');
    expect(result.thumbnailSignedUrl).toBe('https://thumb');
  });

  it('returns the plain photo object when fetching the signed URL fails', async () => {
    const photo = { minioFileId: 'file-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl.mockRejectedValue(new Error('down'));

    const result = await photoService.getPhotoById('p1');
    expect(result).toEqual({ minioFileId: 'file-1' });
  });

  it('logs (does not throw) when the thumbnail signed-url call fails', async () => {
    const photo = { minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl
      .mockResolvedValueOnce({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 })
      .mockRejectedValueOnce(new Error('thumb down'));

    const result = await photoService.getPhotoById('p1');
    expect(result.signedUrl).toBe('https://x');
    expect(result.thumbnailSignedUrl).toBeUndefined();
  });
});

describe('getPhotoByFileId', () => {
  it('throws NotFoundError when no photo matches', async () => {
    mockedFindOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(photoService.getPhotoByFileId('file-1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the matching photo', async () => {
    mockedFindOne.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'p1' }) });
    expect(await photoService.getPhotoByFileId('file-1')).toEqual({ _id: 'p1' });
  });
});

describe('updatePhoto', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(photoService.updatePhoto('p1', {})).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('trims tags and passes through the update', async () => {
    mockedFindById.mockResolvedValue({ _id: 'p1' });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'p1', tags: ['a'] });

    await photoService.updatePhoto('p1', { tags: [' a ', ''] });

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('p1', { tags: ['a'] }, { new: true });
  });
});

describe('deletePhoto', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(photoService.deletePhoto('p1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('deletes files, the photo, and clears the album cover if it was the cover photo', async () => {
    mockedFindById.mockResolvedValue({ minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1' });
    const album: any = { coverPhotoId: 'p1', save: jest.fn().mockResolvedValue(undefined) };
    mockedAlbumFindOne.mockResolvedValue(album);

    await photoService.deletePhoto('p1');

    expect(mockedDeleteFile).toHaveBeenCalledWith('file-1');
    expect(mockedDeleteFile).toHaveBeenCalledWith('thumb-1');
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
    expect(album.coverPhotoId).toBeUndefined();
    expect(album.save).toHaveBeenCalledTimes(1);
  });

  it('still deletes the photo record even if file deletion fails', async () => {
    mockedFindById.mockResolvedValue({ minioFileId: 'file-1' });
    mockedDeleteFile.mockRejectedValue(new Error('down'));
    mockedAlbumFindOne.mockResolvedValue(null);

    await expect(photoService.deletePhoto('p1')).resolves.toBeUndefined();
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
  });

  it('does not touch any album when the deleted photo was not a cover photo', async () => {
    mockedFindById.mockResolvedValue({});
    mockedAlbumFindOne.mockResolvedValue(null);

    await photoService.deletePhoto('p1');
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
  });
});

describe('updatePhotoAIAnalysis', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(photoService.updatePhotoAIAnalysis('p1', {})).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('nests the provided analysis fields under aiAnalysis, matching the schema', async () => {
    mockedFindById.mockResolvedValue({ _id: 'p1' });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'p1' });

    await photoService.updatePhotoAIAnalysis('p1', { objectDetection: { jobId: 'j1' } as any });

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'p1',
      { aiAnalysis: { objectDetection: { jobId: 'j1' } } },
      { new: true }
    );
  });

  it('merges with the existing aiAnalysis so setting one field does not clear the other', async () => {
    mockedFindById.mockResolvedValue({ _id: 'p1', aiAnalysis: { segmentation: { jobId: 's1' } } });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'p1' });

    await photoService.updatePhotoAIAnalysis('p1', { objectDetection: { jobId: 'j1' } as any });

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith(
      'p1',
      { aiAnalysis: { segmentation: { jobId: 's1' }, objectDetection: { jobId: 'j1' } } },
      { new: true }
    );
  });

  it('returns the existing photo without updating when neither field is provided', async () => {
    const existingPhoto = { _id: 'p1' };
    mockedFindById.mockResolvedValue(existingPhoto);

    const result = await photoService.updatePhotoAIAnalysis('p1', {});

    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(result).toBe(existingPhoto);
  });
});

describe('getPhotosForAIAnalysis', () => {
  it('limits and sorts by createdAt descending', async () => {
    const sort = jest.fn().mockResolvedValue([{ _id: 'p1' }]);
    const limit = jest.fn().mockReturnValue({ sort });
    mockedFind.mockReturnValue({ limit });

    const result = await photoService.getPhotosForAIAnalysis('a1', 25);

    expect(limit).toHaveBeenCalledWith(25);
    expect(result).toEqual([{ _id: 'p1' }]);
  });
});
