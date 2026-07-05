jest.mock('../models/Album', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn()
  }
}));

jest.mock('../models/Photo', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    deleteMany: jest.fn()
  }
}));

jest.mock('./fileServiceClient', () => ({
  deleteFile: jest.fn()
}));

import Album from '../models/Album';
import Photo from '../models/Photo';
import { deleteFile } from './fileServiceClient';
import albumService from './albumService';

const mockedFindById = Album.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = Album.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = Album.findByIdAndDelete as unknown as jest.Mock;
const mockedPhotoFind = Photo.find as unknown as jest.Mock;
const mockedPhotoFindOne = Photo.findOne as unknown as jest.Mock;
const mockedPhotoDeleteMany = Photo.deleteMany as unknown as jest.Mock;
const mockedDeleteFile = deleteFile as unknown as jest.Mock;

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
