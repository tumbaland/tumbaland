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
  ctor.aggregate = jest.fn();
  ctor.updateMany = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Album', () => ({
  __esModule: true,
  default: { findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), updateOne: jest.fn() }
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
import { deleteFile, getPhotoSignedUrl, getPhotoSignedUrlsBatch, getFile } from './fileServiceClient';
import { generateThumbnailFromBuffer, isSupportedImageFormat } from './thumbnailService';
import photoService from './photoService';

const mockedFindById = Photo.findById as unknown as jest.Mock;
const mockedFindOne = Photo.findOne as unknown as jest.Mock;
const mockedFind = Photo.find as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Photo.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Photo.findByIdAndDelete as unknown as jest.Mock;
const mockedAggregate = Photo.aggregate as unknown as jest.Mock;
const mockedUpdateMany = Photo.updateMany as unknown as jest.Mock;
const mockedAlbumFindById = Album.findById as unknown as jest.Mock;
const mockedAlbumFindOne = Album.findOne as unknown as jest.Mock;
const mockedAlbumFind = Album.find as unknown as jest.Mock;

/**
 * Who is asking. Every by-id photo operation needs one now: photos carry no
 * owner of their own, so reachability is decided by the album they sit in, and
 * until this was added any signed-in caller could read, retitle, retag or
 * delete any other account's photo by naming its id.
 */
const OWNER = { userId: 'user-1', userGroups: ['g1'] };

/** Album lookups used by the reachability check. */
const albumsReachable = (albums: Record<string, unknown>[] = [{ _id: 'a1', userId: 'user-1' }]) =>
  mockedAlbumFind.mockReturnValue({ select: () => ({ lean: async () => albums }) });

/** The candidate lookup bulk tagging does before narrowing to what is reachable. */
const photosInAlbum = (photos: Record<string, unknown>[]) =>
  mockedFind.mockReturnValue({ select: () => ({ lean: async () => photos }) });
const mockedAlbumUpdateOne = Album.updateOne as unknown as jest.Mock;
const mockedDeleteFile = deleteFile as unknown as jest.Mock;
const mockedGetPhotoSignedUrl = getPhotoSignedUrl as unknown as jest.Mock;
const mockedGetPhotoSignedUrlsBatch = getPhotoSignedUrlsBatch as unknown as jest.Mock;
const mockedGetFile = getFile as unknown as jest.Mock;
const mockedGenerateThumbnail = generateThumbnailFromBuffer as unknown as jest.Mock;
const mockedIsSupported = isSupportedImageFormat as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Reachability is decided by the album a photo sits in, so every by-id test
  // needs one the caller owns unless it is deliberately testing a refusal.
  albumsReachable();
});

describe('createPhoto', () => {
  const baseInput = {
    filename: 'x.jpg',
    originalName: 'x.jpg',
    minioFileId: 'file-1',
    albumId: 'a1',
    mimetype: 'image/jpeg',
    size: 100
  };

  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    await expect(photoService.createPhoto(baseInput, 'user-1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws ConflictError when a photo with the same minioFileId already exists', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1', coverPhotoId: 'existing' });
    mockedFindOne.mockResolvedValue({ _id: 'other-photo' });

    await expect(photoService.createPhoto(baseInput, 'user-1')).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('creates the photo and sets it as the album cover when none is set', async () => {
    const album: any = {
      _id: 'a1',
      userId: 'user-1',
      coverPhotoId: undefined,
      save: jest.fn().mockResolvedValue(undefined)
    };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(false);

    const result = await photoService.createPhoto(baseInput, 'user-1');

    expect(result._id).toBe('new-photo-id');
    expect(album.coverPhotoId).toBe('new-photo-id');
    expect(album.save).toHaveBeenCalledTimes(1);
    expect(mockedAlbumUpdateOne).toHaveBeenCalledWith({ _id: 'a1' }, { $inc: { photoCount: 1, totalSize: 100 } });
  });

  it('does not overwrite an existing album cover', async () => {
    const album: any = { _id: 'a1', userId: 'user-1', coverPhotoId: 'existing-cover', save: jest.fn() };
    mockedAlbumFindById.mockResolvedValue(album);
    mockedFindOne.mockResolvedValue(null);
    mockedIsSupported.mockReturnValue(false);

    await photoService.createPhoto(baseInput, 'user-1');

    expect(album.coverPhotoId).toBe('existing-cover');
    expect(album.save).not.toHaveBeenCalled();
  });

  it('kicks off async thumbnail generation for supported image formats', async () => {
    const album: any = { _id: 'a1', userId: 'user-1', coverPhotoId: 'x', save: jest.fn() };
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
    const album: any = { _id: 'a1', userId: 'user-1', coverPhotoId: 'x', save: jest.fn() };
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
    const query: any = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis()
    };
    query.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return query;
  }

  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    await expect(photoService.getPhotosByAlbum('a1', {}, OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns paginated photos with signed URLs', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    const photo = {
      albumId: 'a1',
      minioFileId: 'file-1',
      minioThumbnailFileId: undefined,
      toObject: () => ({ minioFileId: 'file-1' })
    };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({
      'file-1': { signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 }
    });

    const result = await photoService.getPhotosByAlbum('a1', { page: 1, limit: 10 }, OWNER);

    expect(result.photos[0]).toMatchObject({ signedUrl: 'https://x' });
    expect(result.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('continues (empty signed URL map) when the batch signed-url call fails', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    const photo = { albumId: 'a1', minioFileId: 'file-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch.mockRejectedValue(new Error('down'));

    const result = await photoService.getPhotosByAlbum('a1', {}, OWNER);
    expect(result.photos[0].signedUrl).toBeUndefined();
  });

  it('narrows the query to photos carrying every selected tag', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    mockedFind.mockReturnValue(chainable([]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(0);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({});

    await photoService.getPhotosByAlbum('a1', { tags: ['Beach', ' sunset '] }, OWNER);

    expect(mockedFind).toHaveBeenCalledWith({ albumId: 'a1', tags: { $all: ['beach', 'sunset'] } });
  });

  it('widens the query to the union of the selected tags when tagMatch is any', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    mockedFind.mockReturnValue(chainable([]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(0);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({});

    await photoService.getPhotosByAlbum('a1', { tags: ['beach', 'sunset'], tagMatch: 'any' }, OWNER);

    expect(mockedFind).toHaveBeenCalledWith({ albumId: 'a1', tags: { $in: ['beach', 'sunset'] } });
  });

  it('does not filter when the tag list is empty or only whitespace', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    mockedFind.mockReturnValue(chainable([]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(0);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({});

    await photoService.getPhotosByAlbum('a1', { tags: ['  ', ''] }, OWNER);

    expect(mockedFind).toHaveBeenCalledWith({ albumId: 'a1' });
  });

  it('also fetches thumbnail signed URLs for photos that have a thumbnail', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    const photo = {
      albumId: 'a1',
      minioFileId: 'file-1',
      minioThumbnailFileId: 'thumb-1',
      toObject: () => ({ minioFileId: 'file-1' })
    };
    mockedFind.mockReturnValue(chainable([photo]));
    (Photo.countDocuments as unknown as jest.Mock) = jest.fn().mockResolvedValue(1);
    mockedGetPhotoSignedUrlsBatch
      .mockResolvedValueOnce({ 'file-1': { signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 } })
      .mockResolvedValueOnce({ 'file-1': { signedUrl: 'https://thumb', expiresAt: 't', expiresInMinutes: 60 } });

    const result = await photoService.getPhotosByAlbum('a1', {}, OWNER);
    expect(result.photos[0].thumbnailSignedUrl).toBe('https://thumb');
  });
});

describe('getPhotoById', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(photoService.getPhotoById('p1', OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the photo enriched with a signed URL', async () => {
    const photo = {
      albumId: 'a1',
      minioFileId: 'file-1',
      minioThumbnailFileId: undefined,
      toObject: () => ({ minioFileId: 'file-1' })
    };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl.mockResolvedValue({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 });

    const result = await photoService.getPhotoById('p1', OWNER);
    expect(result.signedUrl).toBe('https://x');
  });

  it('also enriches with a thumbnail signed URL when one exists', async () => {
    const photo = {
      albumId: 'a1',
      minioFileId: 'file-1',
      minioThumbnailFileId: 'thumb-1',
      toObject: () => ({ minioFileId: 'file-1' })
    };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl
      .mockResolvedValueOnce({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 })
      .mockResolvedValueOnce({ signedUrl: 'https://thumb', expiresAt: 't', expiresInMinutes: 60 });

    const result = await photoService.getPhotoById('p1', OWNER);
    expect(result.thumbnailSignedUrl).toBe('https://thumb');
  });

  it('returns the plain photo object when fetching the signed URL fails', async () => {
    const photo = { albumId: 'a1', minioFileId: 'file-1', toObject: () => ({ minioFileId: 'file-1' }) };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl.mockRejectedValue(new Error('down'));

    const result = await photoService.getPhotoById('p1', OWNER);
    expect(result).toEqual({ minioFileId: 'file-1' });
  });

  it('logs (does not throw) when the thumbnail signed-url call fails', async () => {
    const photo = {
      albumId: 'a1',
      minioFileId: 'file-1',
      minioThumbnailFileId: 'thumb-1',
      toObject: () => ({ minioFileId: 'file-1' })
    };
    mockedFindById.mockReturnValue({ populate: jest.fn().mockResolvedValue(photo) });
    mockedGetPhotoSignedUrl
      .mockResolvedValueOnce({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 })
      .mockRejectedValueOnce(new Error('thumb down'));

    const result = await photoService.getPhotoById('p1', OWNER);
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
    await expect(photoService.updatePhoto('p1', {}, OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('trims tags and passes through the update', async () => {
    mockedFindById.mockResolvedValue({ albumId: 'a1', _id: 'p1' });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'p1', tags: ['a'] });

    await photoService.updatePhoto('p1', { tags: [' a ', ''] }, OWNER);

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('p1', { tags: ['a'] }, { new: true });
  });
});

describe('deletePhoto', () => {
  it('throws NotFoundError when the photo does not exist', async () => {
    mockedFindById.mockResolvedValue(null);
    await expect(photoService.deletePhoto('p1', OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('deletes files, the photo, and clears the album cover if it was the cover photo', async () => {
    mockedFindById.mockResolvedValue({
      albumId: 'a1',
      size: 100,
      minioFileId: 'file-1',
      minioThumbnailFileId: 'thumb-1'
    });
    const album: any = { coverPhotoId: 'p1', save: jest.fn().mockResolvedValue(undefined) };
    mockedAlbumFindOne.mockResolvedValue(album);

    await photoService.deletePhoto('p1', OWNER);

    expect(mockedDeleteFile).toHaveBeenCalledWith('file-1');
    expect(mockedDeleteFile).toHaveBeenCalledWith('thumb-1');
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
    expect(mockedAlbumUpdateOne).toHaveBeenCalledWith({ _id: 'a1' }, { $inc: { photoCount: -1, totalSize: -100 } });
    expect(album.coverPhotoId).toBeUndefined();
    expect(album.save).toHaveBeenCalledTimes(1);
  });

  it('still deletes the photo record even if file deletion fails', async () => {
    mockedFindById.mockResolvedValue({ albumId: 'a1', size: 100, minioFileId: 'file-1' });
    mockedDeleteFile.mockRejectedValue(new Error('down'));
    mockedAlbumFindOne.mockResolvedValue(null);

    // Still returns the deleted document: the caller needs its size to hand
    // the bytes back to the storage meter.
    await expect(photoService.deletePhoto('p1', OWNER)).resolves.toMatchObject({ size: 100 });
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
  });

  it('does not touch any album when the deleted photo was not a cover photo', async () => {
    mockedFindById.mockResolvedValue({ albumId: 'a1', size: 50 });
    mockedAlbumFindOne.mockResolvedValue(null);

    await photoService.deletePhoto('p1', OWNER);
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('p1');
  });
});

describe('getAlbumTags', () => {
  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    await expect(photoService.getAlbumTags('68d8f4b1c2a3b4d5e6f70123', OWNER)).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('throws NotFoundError rather than a cast error for a malformed album id', async () => {
    await expect(photoService.getAlbumTags('not-an-id', OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns each tag with its usage count', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'user-1' });
    mockedAggregate.mockResolvedValue([
      { _id: 'beach', count: 4 },
      { _id: 'sunset', count: 1 }
    ]);

    await expect(photoService.getAlbumTags('68d8f4b1c2a3b4d5e6f70123', OWNER)).resolves.toEqual([
      { tag: 'beach', count: 4 },
      { tag: 'sunset', count: 1 }
    ]);
  });
});

describe('bulkUpdateTags', () => {
  const photoId = '68d8f4b1c2a3b4d5e6f70123';

  it('is a no-op when there are no photos or no tag changes', async () => {
    await expect(photoService.bulkUpdateTags({ photoIds: [], add: ['beach'] }, OWNER)).resolves.toEqual({
      matched: 0,
      modified: 0,
      tags: []
    });
    await expect(photoService.bulkUpdateTags({ photoIds: [photoId] }, OWNER)).resolves.toEqual({
      matched: 0,
      modified: 0,
      tags: []
    });
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('adds normalized tags with $addToSet so re-tagging does not duplicate', async () => {
    photosInAlbum([{ _id: photoId, albumId: 'a1' }]);
    mockedUpdateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
    mockedFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const result = await photoService.bulkUpdateTags({ photoIds: [photoId], add: ['Beach', 'beach ', ''] }, OWNER);

    expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockedUpdateMany.mock.calls[0][1]).toEqual({ $addToSet: { tags: { $each: ['beach'] } } });
    expect(result).toMatchObject({ matched: 2, modified: 2 });
  });

  it("pulls removed tags and returns the album's refreshed tag list", async () => {
    photosInAlbum([{ _id: photoId, albumId: 'a1' }]);
    mockedUpdateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockedFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ albumId: '68d8f4b1c2a3b4d5e6f70999' })
    });
    mockedAlbumFindById.mockResolvedValue({ _id: '68d8f4b1c2a3b4d5e6f70999', userId: 'user-1' });
    mockedAggregate.mockResolvedValue([{ _id: 'sunset', count: 3 }]);

    const result = await photoService.bulkUpdateTags({ photoIds: [photoId], remove: ['Beach'] }, OWNER);

    expect(mockedUpdateMany.mock.calls[0][1]).toEqual({ $pull: { tags: { $in: ['beach'] } } });
    expect(result.tags).toEqual([{ tag: 'sunset', count: 3 }]);
  });

  it('ignores ids that are not valid ObjectIds', async () => {
    await expect(photoService.bulkUpdateTags({ photoIds: ['not-an-id'], add: ['beach'] }, OWNER)).resolves.toEqual({
      matched: 0,
      modified: 0,
      tags: []
    });
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });
});

/**
 * A photo carries no owner of its own, so reachability is decided by the album
 * it sits in. Until this was added, `getPhotoById`, `updatePhoto`, `deletePhoto`
 * and `bulkUpdateTags` all took an id and nothing else: any signed-in caller
 * could read, retitle, retag or delete any other account's photo by naming its
 * id, and `getPhotoById` answers with a working signed URL to the image file.
 */
describe('reaching another account’s photos', () => {
  const STRANGER = { userId: 'someone-else', userGroups: [] };
  const photoId = '68d8f4b1c2a3b4d5e6f70123';
  const inSomeoneElsesAlbum = () => {
    mockedFindById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        albumId: 'a1',
        minioFileId: 'file-1',
        toObject: () => ({ minioFileId: 'file-1' })
      })
    });
    // The album exists but belongs to someone else, so it is not in the
    // reachable set.
    albumsReachable([]);
  };

  it('refuses a read, before a signed URL is ever minted', async () => {
    inSomeoneElsesAlbum();

    await expect(photoService.getPhotoById('p1', STRANGER)).rejects.toMatchObject({
      name: 'NotFoundError'
    });
    expect(mockedGetPhotoSignedUrl).not.toHaveBeenCalled();
  });

  it('reports a miss rather than a refusal, so ids cannot be probed', async () => {
    // "Not yours" and "not there" have to be indistinguishable, or the error
    // confirms an id exists to someone guessing at them.
    inSomeoneElsesAlbum();

    await expect(photoService.getPhotoById('p1', STRANGER)).rejects.toMatchObject({
      message: 'Photo not found'
    });
  });

  it('refuses an edit', async () => {
    mockedFindById.mockResolvedValue({ albumId: 'a1', _id: 'p1' });
    albumsReachable([]);

    await expect(photoService.updatePhoto('p1', { title: 'Mine now' }, STRANGER)).rejects.toMatchObject({
      name: 'NotFoundError'
    });
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a delete, so no file is destroyed', async () => {
    mockedFindById.mockResolvedValue({ albumId: 'a1', _id: 'p1', minioFileId: 'file-1' });
    albumsReachable([]);

    await expect(photoService.deletePhoto('p1', STRANGER)).rejects.toMatchObject({
      name: 'NotFoundError'
    });
    expect(mockedDeleteFile).not.toHaveBeenCalled();
  });

  it('drops unreachable photos from a bulk tag instead of failing the batch', async () => {
    // Silently: a caller tagging a mix of their own and someone else's photos
    // learns nothing about which ids were real.
    photosInAlbum([
      { _id: photoId, albumId: 'a1' },
      { _id: photoId, albumId: 'not-yours' }
    ]);
    albumsReachable([{ _id: 'a1', userId: 'user-1' }]);
    mockedUpdateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockedFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await photoService.bulkUpdateTags({ photoIds: [photoId], add: ['beach'] }, OWNER);

    expect(mockedUpdateMany.mock.calls[0][0]._id.$in).toHaveLength(1);
  });

  it('touches nothing when none of the photos are reachable', async () => {
    photosInAlbum([{ _id: photoId, albumId: 'not-yours' }]);
    albumsReachable([]);

    await expect(photoService.bulkUpdateTags({ photoIds: [photoId], add: ['beach'] }, STRANGER)).resolves.toEqual({
      matched: 0,
      modified: 0,
      tags: []
    });
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses to list an album the caller cannot reach, before any URL is signed', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'owner', isPublic: false });

    await expect(photoService.getPhotosByAlbum('a1', {}, STRANGER)).rejects.toMatchObject({
      message: 'Album not found'
    });
    expect(mockedFind).not.toHaveBeenCalled();
    expect(mockedGetPhotoSignedUrlsBatch).not.toHaveBeenCalled();
  });

  it('refuses the tag list of an album the caller cannot reach', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'owner', isPublic: false });

    await expect(photoService.getAlbumTags(photoId, STRANGER)).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(mockedAggregate).not.toHaveBeenCalled();
  });

  it('refuses to add a photo to an album the caller cannot write to', async () => {
    mockedAlbumFindById.mockResolvedValue({ _id: 'a1', userId: 'owner', isPublic: true });
    const input = {
      filename: 'x.jpg',
      originalName: 'x.jpg',
      minioFileId: 'file-1',
      albumId: 'a1',
      mimetype: 'image/jpeg',
      size: 100
    };

    await expect(
      photoService.createPhoto(input, STRANGER.userId, undefined, STRANGER.userGroups)
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(Photo).not.toHaveBeenCalled();
    expect(mockedAlbumUpdateOne).not.toHaveBeenCalled();
  });

  describe('in a public album', () => {
    const publicAlbum = [{ _id: 'a1', userId: 'owner', isPublic: true }];

    it('lets anyone look', async () => {
      mockedFindById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          albumId: 'a1',
          minioFileId: 'file-1',
          toObject: () => ({ minioFileId: 'file-1' })
        })
      });
      albumsReachable(publicAlbum);
      mockedGetPhotoSignedUrl.mockResolvedValue({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 });

      await expect(photoService.getPhotoById('p1', STRANGER)).resolves.toMatchObject({ signedUrl: 'https://x' });
    });

    it('does not let a stranger edit, delete or retag', async () => {
      albumsReachable(publicAlbum);
      mockedFindById.mockResolvedValue({ albumId: 'a1', _id: 'p1', minioFileId: 'file-1' });

      await expect(photoService.updatePhoto('p1', { title: 'Mine now' }, STRANGER)).rejects.toMatchObject({
        name: 'NotFoundError'
      });
      await expect(photoService.deletePhoto('p1', STRANGER)).rejects.toMatchObject({ name: 'NotFoundError' });

      photosInAlbum([{ _id: photoId, albumId: 'a1' }]);
      await expect(photoService.bulkUpdateTags({ photoIds: [photoId], add: ['mine'] }, STRANGER)).resolves.toEqual({
        matched: 0,
        modified: 0,
        tags: []
      });

      expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockedDeleteFile).not.toHaveBeenCalled();
      expect(mockedUpdateMany).not.toHaveBeenCalled();
    });
  });
});
