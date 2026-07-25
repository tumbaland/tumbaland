jest.mock('../models/Album', () => {
  const ctor: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: 'new-album-id' })
  }));
  ctor.findById = jest.fn();
  ctor.findByIdAndUpdate = jest.fn();
  ctor.findByIdAndDelete = jest.fn();
  ctor.aggregate = jest.fn();
  ctor.find = jest.fn();
  ctor.countDocuments = jest.fn();
  return { __esModule: true, default: ctor };
});

jest.mock('../models/Photo', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    deleteMany: jest.fn()
  }
}));

jest.mock('./fileServiceClient', () => ({
  deleteFile: jest.fn(),
  getPhotoSignedUrl: jest.fn(),
  getPhotoSignedUrlsBatch: jest.fn()
}));

import Album from '../models/Album';
import Photo from '../models/Photo';
import { deleteFile, getPhotoSignedUrl, getPhotoSignedUrlsBatch } from './fileServiceClient';
import albumService from './albumService';

const mockedCtor = Album as unknown as jest.Mock;
const mockedFindById = Album.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Album.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Album.findByIdAndDelete as unknown as jest.Mock;
const mockedAggregate = Album.aggregate as unknown as jest.Mock;
const mockedFind = Album.find as unknown as jest.Mock;
const mockedCountDocuments = Album.countDocuments as unknown as jest.Mock;
const mockedPhotoFind = Photo.find as unknown as jest.Mock;
const mockedPhotoFindOne = Photo.findOne as unknown as jest.Mock;
const mockedPhotoDeleteMany = Photo.deleteMany as unknown as jest.Mock;
const mockedDeleteFile = deleteFile as unknown as jest.Mock;
const mockedGetPhotoSignedUrl = getPhotoSignedUrl as unknown as jest.Mock;
const mockedGetPhotoSignedUrlsBatch = getPhotoSignedUrlsBatch as unknown as jest.Mock;

function ctx(overrides: Partial<{ userId: string; userGroups: string[] }> = {}) {
  return { userId: overrides.userId ?? 'user-1', userGroups: overrides.userGroups ?? [] };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAlbum', () => {
  it('throws NotFoundError when the album does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(albumService.updateAlbum('album-1', { name: 'New' }, ctx())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('rejects a user with no access to the album', async () => {
    mockedFindById.mockResolvedValue({ userId: 'someone-else', groupId: undefined, isPublic: false });

    await expect(albumService.updateAlbum('album-1', { name: 'New' }, ctx())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows a group member to update a group album and trims the new name', async () => {
    mockedFindById.mockResolvedValue({ userId: 'owner', groupId: 'group-1', isPublic: false });
    mockedFindByIdAndUpdate.mockResolvedValue({ name: 'Trimmed' });

    await albumService.updateAlbum('album-1', { name: '  Trimmed  ' }, ctx({ userGroups: ['group-1'] }));

    expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('album-1', { name: 'Trimmed' }, { new: true });
  });

  it('allows anyone to update a public album', async () => {
    mockedFindById.mockResolvedValue({ userId: 'owner', groupId: undefined, isPublic: true });
    mockedFindByIdAndUpdate.mockResolvedValue({ name: 'New' });

    await albumService.updateAlbum('album-1', { name: 'New' }, ctx({ userId: 'stranger' }));

    expect(mockedFindByIdAndUpdate).toHaveBeenCalled();
  });
});

describe('deleteAlbum', () => {
  it('throws NotFoundError when the album does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(albumService.deleteAlbum('album-1')).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(mockedPhotoDeleteMany).not.toHaveBeenCalled();
  });

  it('deletes files for every photo, then the photos, then the album', async () => {
    mockedFindById.mockResolvedValue({ _id: 'album-1' });
    mockedPhotoFind.mockResolvedValue([
      { minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1' },
      { minioFileId: 'file-2', minioThumbnailFileId: undefined }
    ]);
    mockedDeleteFile.mockResolvedValue(true);

    await albumService.deleteAlbum('album-1');

    expect(mockedDeleteFile).toHaveBeenCalledWith('file-1');
    expect(mockedDeleteFile).toHaveBeenCalledWith('thumb-1');
    expect(mockedDeleteFile).toHaveBeenCalledWith('file-2');
    expect(mockedDeleteFile).toHaveBeenCalledTimes(3);
    expect(mockedPhotoDeleteMany).toHaveBeenCalledWith({ albumId: 'album-1' });
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('album-1');
  });

  it('still deletes the photos and album even if a file delete fails', async () => {
    mockedFindById.mockResolvedValue({ _id: 'album-1' });
    mockedPhotoFind.mockResolvedValue([{ minioFileId: 'file-1' }]);
    mockedDeleteFile.mockRejectedValue(new Error('storage unavailable'));

    await expect(albumService.deleteAlbum('album-1')).resolves.toBeUndefined();

    expect(mockedPhotoDeleteMany).toHaveBeenCalledWith({ albumId: 'album-1' });
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('album-1');
  });
});

describe('setCoverPhoto', () => {
  it('throws NotFoundError when the album does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(albumService.setCoverPhoto('album-1', 'photo-1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws NotFoundError when the photo does not belong to the album', async () => {
    mockedFindById.mockResolvedValue({ _id: 'album-1', save: jest.fn() });
    mockedPhotoFindOne.mockResolvedValue(null);

    await expect(albumService.setCoverPhoto('album-1', 'photo-1')).rejects.toMatchObject({ name: 'NotFoundError' });
    expect(mockedPhotoFindOne).toHaveBeenCalledWith({ _id: 'photo-1', albumId: 'album-1' });
  });

  it('sets the cover photo when it belongs to the album', async () => {
    const album: any = { _id: 'album-1', save: jest.fn().mockResolvedValue(undefined) };
    mockedFindById.mockResolvedValue(album);
    mockedPhotoFindOne.mockResolvedValue({ _id: 'photo-1', albumId: 'album-1' });

    await albumService.setCoverPhoto('album-1', 'photo-1');

    expect(album.coverPhotoId).toBe('photo-1');
    expect(album.save).toHaveBeenCalledTimes(1);
  });
});

describe('removeCoverPhoto', () => {
  it('throws NotFoundError when the album does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(albumService.removeCoverPhoto('album-1')).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('clears the cover photo', async () => {
    const album: any = { _id: 'album-1', coverPhotoId: 'photo-1', save: jest.fn().mockResolvedValue(undefined) };
    mockedFindById.mockResolvedValue(album);

    await albumService.removeCoverPhoto('album-1');

    expect(album.coverPhotoId).toBeUndefined();
    expect(album.save).toHaveBeenCalledTimes(1);
  });
});

describe('createAlbum', () => {
  it('trims name/description/tags and stamps the userId', async () => {
    const result: any = await albumService.createAlbum(
      { name: '  Trip  ', description: '  desc  ', tags: [' a ', '', ' b '] },
      'user-1'
    );

    expect(mockedCtor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Trip', description: 'desc', tags: ['a', 'b'], userId: 'user-1' })
    );
    expect(result._id).toBe('new-album-id');
  });
});

function albumsChainable(result: unknown[]) {
  const query: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result)
  };
  return query;
}

describe('getAlbums', () => {
  it('scopes to personal albums (no groupId) by default', async () => {
    mockedFind.mockReturnValueOnce(albumsChainable([{ _id: 'a1', coverPhotoId: undefined, photoCount: 0, totalSize: 0 }]));
    mockedCountDocuments.mockResolvedValueOnce(1);

    const result = await albumService.getAlbums({}, ctx());

    expect(mockedFind).toHaveBeenCalledWith({ userId: 'user-1', groupId: { $exists: false } });
    expect(mockedCountDocuments).toHaveBeenCalledWith({ userId: 'user-1', groupId: { $exists: false } });
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  it('throws ForbiddenError when filtering by a group the user is not a member of', async () => {
    await expect(albumService.getAlbums({ groupId: 'g1' }, ctx())).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('throws a plain Error (not ForbiddenError) when group-service is down and groupId access cannot be verified', async () => {
    await expect(
      albumService.getAlbums({ groupId: 'g1' }, { userId: 'user-1', userGroups: [], groupServiceError: true })
    ).rejects.toMatchObject({ message: 'Group service temporarily unavailable. Please try again.' });
  });

  it('scopes by groupId when the user is a member', async () => {
    mockedFind.mockReturnValueOnce(albumsChainable([]));
    mockedCountDocuments.mockResolvedValueOnce(0);

    await albumService.getAlbums({ groupId: 'g1' }, ctx({ userGroups: ['g1'] }));

    expect(mockedFind).toHaveBeenCalledWith({ groupId: 'g1' });
  });

  it('skips cover-photo enrichment when includeCover is false', async () => {
    mockedFind.mockReturnValueOnce(albumsChainable([{ _id: 'a1', coverPhotoId: 'p1', photoCount: 1, totalSize: 100 }]));
    mockedCountDocuments.mockResolvedValueOnce(1);

    const result = await albumService.getAlbums({ includeCover: false }, ctx());

    expect(result.albums[0]).toMatchObject({ coverPhoto: null });
    expect(mockedPhotoFind).not.toHaveBeenCalled();
  });

  it('enriches albums with cover photo signed URLs when includeCover is true', async () => {
    mockedFind.mockReturnValueOnce(albumsChainable([{ _id: 'a1', coverPhotoId: 'p1', photoCount: 1, totalSize: 100 }]));
    mockedCountDocuments.mockResolvedValueOnce(1);
    mockedPhotoFind.mockResolvedValue([
      { id: 'p1', minioFileId: 'file-1', mimetype: 'image/jpeg', toObject: () => ({ id: 'p1' }) }
    ]);
    mockedGetPhotoSignedUrlsBatch.mockResolvedValue({ 'file-1': { signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 } });

    const result = await albumService.getAlbums({}, ctx());

    expect(result.albums[0].coverPhoto).toMatchObject({ signedUrl: 'https://x' });
  });
});

describe('getAlbumById', () => {
  it('throws NotFoundError when the aggregation returns nothing', async () => {
    mockedAggregate.mockResolvedValue([]);

    await expect(albumService.getAlbumById('507f1f77bcf86cd799439011', ctx())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
  });

  it('throws ForbiddenError when the user cannot access a private, non-owned album', async () => {
    mockedAggregate.mockResolvedValue([{ _id: 'a1', userId: 'someone-else', isPublic: false }]);

    await expect(albumService.getAlbumById('507f1f77bcf86cd799439011', ctx())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });

  it('returns the album with a resolved cover photo when accessible', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: 'a1',
        userId: 'user-1',
        isPublic: false,
        coverPhotoDoc: { minioFileId: 'file-1', mimetype: 'image/jpeg' }
      }
    ]);
    mockedGetPhotoSignedUrl.mockResolvedValue({ signedUrl: 'https://x', expiresAt: 't', expiresInMinutes: 60 });

    const result = await albumService.getAlbumById('507f1f77bcf86cd799439011', ctx());

    expect(result.coverPhoto).toMatchObject({ signedUrl: 'https://x' });
    expect('coverPhotoDoc' in result).toBe(false);
  });

  it('returns the album with no cover photo when none is set', async () => {
    mockedAggregate.mockResolvedValue([{ _id: 'a1', userId: 'user-1', isPublic: false, coverPhotoDoc: undefined }]);

    const result = await albumService.getAlbumById('507f1f77bcf86cd799439011', ctx());

    expect(result.coverPhoto).toBeNull();
  });
});
