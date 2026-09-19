jest.mock('./collage.model', () => {
  const CollageModel: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue(undefined)
  }));
  CollageModel.findById = jest.fn();
  CollageModel.findByIdAndUpdate = jest.fn();
  CollageModel.findByIdAndDelete = jest.fn();
  CollageModel.find = jest.fn();
  return { CollageModel };
});

jest.mock('../models/Album', () => ({ __esModule: true, default: { aggregate: jest.fn() } }));
jest.mock('../services/fileServiceClient', () => ({ getSignedUrlsBatch: jest.fn() }));

import { CollageModel } from './collage.model';
import Album from '../models/Album';
import { getSignedUrlsBatch } from '../services/fileServiceClient';
import {
  createCollage,
  updateCollage,
  getCollageById,
  getCollageList,
  deleteCollage,
  getCollageWithPhotos
} from './collage.service';
import { CollageInput } from './collage.types';

const mockedAggregate = Album.aggregate as unknown as jest.Mock;
const mockedGetSignedUrlsBatch = getSignedUrlsBatch as unknown as jest.Mock;

const mockedCtor = CollageModel as unknown as jest.Mock;
const mockedFindById = CollageModel.findById as unknown as jest.Mock;
const mockedFindByIdAndUpdate = CollageModel.findByIdAndUpdate as unknown as jest.Mock;
const mockedFindByIdAndDelete = CollageModel.findByIdAndDelete as unknown as jest.Mock;
const mockedFind = CollageModel.find as unknown as jest.Mock;

const OWNER = 'user-1';
const OTHER = 'user-2';

const collageInput = { title: 'My Collage', albumIds: ['album-1'], config: { photos: [] } } as unknown as CollageInput;

describe('collage.service', () => {
  describe('createCollage', () => {
    it('stamps the userId onto the saved collage', async () => {
      const result: any = await createCollage(collageInput, OWNER);
      expect(mockedCtor).toHaveBeenCalledWith(expect.objectContaining({ title: 'My Collage', userId: OWNER }));
      expect(result.userId).toBe(OWNER);
      expect(result.save).toHaveBeenCalled();
    });
  });

  describe('getCollageById', () => {
    it('returns null when the collage does not exist', async () => {
      mockedFindById.mockResolvedValue(null);
      expect(await getCollageById('missing', OWNER)).toBeNull();
    });

    it('returns the collage for its owner', async () => {
      const collage = { _id: 'c1', userId: OWNER };
      mockedFindById.mockResolvedValue(collage);
      expect(await getCollageById('c1', OWNER)).toBe(collage);
    });

    it('throws ForbiddenError for a non-owner with no group access', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      await expect(getCollageById('c1', OTHER)).rejects.toMatchObject({ name: 'ForbiddenError' });
    });

    it('allows a member of the collage group', async () => {
      const collage = { _id: 'c1', userId: OWNER, groupId: 'group-9' };
      mockedFindById.mockResolvedValue(collage);
      expect(await getCollageById('c1', OTHER, ['group-9'])).toBe(collage);
    });
  });

  describe('updateCollage', () => {
    it('throws NotFoundError when the collage does not exist', async () => {
      mockedFindById.mockResolvedValue(null);
      await expect(updateCollage('missing', collageInput, OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ForbiddenError when the user cannot access the collage', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      await expect(updateCollage('c1', collageInput, OTHER)).rejects.toMatchObject({ name: 'ForbiddenError' });
      expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('updates and returns the collage for an authorized user', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      const updated = { _id: 'c1', title: 'Updated' };
      mockedFindByIdAndUpdate.mockResolvedValue(updated);

      const result = await updateCollage('c1', collageInput, OWNER);

      expect(mockedFindByIdAndUpdate).toHaveBeenCalledWith('c1', collageInput, { new: true });
      expect(result).toBe(updated);
    });
  });

  describe('writing into a group', () => {
    it('refuses to create a collage in a group the caller is not in', async () => {
      const calls = mockedCtor.mock.calls.length;

      await expect(createCollage({ ...collageInput, groupId: 'group-9' }, OWNER, [])).rejects.toMatchObject({
        name: 'ForbiddenError'
      });
      expect(mockedCtor.mock.calls.length).toBe(calls);
    });

    it('refuses to move a collage into a group the caller is not in', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      const calls = mockedFindByIdAndUpdate.mock.calls.length;

      await expect(updateCollage('c1', { ...collageInput, groupId: 'group-9' }, OWNER, [])).rejects.toMatchObject({
        name: 'ForbiddenError'
      });
      expect(mockedFindByIdAndUpdate.mock.calls.length).toBe(calls);
    });
  });

  describe('deleteCollage', () => {
    it('throws NotFoundError when the collage does not exist', async () => {
      mockedFindById.mockResolvedValue(null);
      await expect(deleteCollage('missing', OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ForbiddenError when the user cannot access the collage', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      await expect(deleteCollage('c1', OTHER)).rejects.toMatchObject({ name: 'ForbiddenError' });
      expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
    });

    it('deletes the collage for an authorized user', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER });
      mockedFindByIdAndDelete.mockResolvedValue({ _id: 'c1' });

      await deleteCollage('c1', OWNER);

      expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('c1');
    });
  });

  describe('getCollageList', () => {
    beforeEach(() => {
      mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    });

    it('filters by albumId when provided', async () => {
      await getCollageList('album-1', OWNER);
      expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ albumIds: { $in: ['album-1'] } }));
    });

    it('scopes to personal collages (no group) when no groupId is given', async () => {
      await getCollageList(undefined, OWNER);
      expect(mockedFind).toHaveBeenCalledWith({ userId: OWNER, groupId: { $exists: false } });
    });

    it('scopes to a group when the user is a member', async () => {
      await getCollageList(undefined, OWNER, ['group-9'], 'group-9');
      expect(mockedFind).toHaveBeenCalledWith({ groupId: 'group-9' });
    });

    it('throws ForbiddenError when requesting a group the user does not belong to', async () => {
      await expect(getCollageList(undefined, OWNER, [], 'group-9')).rejects.toMatchObject({ name: 'ForbiddenError' });
      expect(mockedFind).not.toHaveBeenCalled();
    });

    it('sorts results by createdAt descending', async () => {
      const sort = jest.fn().mockResolvedValue([{ _id: 'c1' }]);
      mockedFind.mockReturnValue({ sort });
      const result = await getCollageList(undefined, OWNER);
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual([{ _id: 'c1' }]);
    });
  });

  describe('getCollageWithPhotos', () => {
    const collageId = '507f1f77bcf86cd799439011';

    it('throws NotFoundError when the collage does not exist', async () => {
      mockedFindById.mockResolvedValue(null);
      await expect(getCollageWithPhotos(collageId, OWNER)).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ForbiddenError when an album in the collage is not accessible', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER, albumIds: ['507f1f77bcf86cd799439012'] });
      mockedAggregate.mockResolvedValue([{ userId: 'someone-else', groupId: undefined, photos: [] }]);

      await expect(getCollageWithPhotos(collageId, OWNER)).rejects.toMatchObject({ name: 'ForbiddenError' });
    });

    it('returns the collage with photos enriched with signed URLs', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER, albumIds: ['507f1f77bcf86cd799439012'] });
      mockedAggregate.mockResolvedValue([
        {
          userId: OWNER,
          photos: [{ _id: 'p1', minioFileId: 'file-1', minioThumbnailFileId: 'thumb-1' }]
        }
      ]);
      mockedGetSignedUrlsBatch.mockResolvedValue({
        'file-1': { signedUrl: 'https://original', expiresAt: 't', expiresInMinutes: 60 },
        'thumb-1': { signedUrl: 'https://thumb', expiresAt: 't', expiresInMinutes: 60 }
      });

      const result = await getCollageWithPhotos(collageId, OWNER);

      expect(result.photos[0]).toMatchObject({ signedUrl: 'https://original', thumbnailSignedUrl: 'https://thumb' });
    });

    it('still returns the collage (with un-enriched photos) when the signed-url batch call fails', async () => {
      mockedFindById.mockResolvedValue({ _id: 'c1', userId: OWNER, albumIds: ['507f1f77bcf86cd799439012'] });
      mockedAggregate.mockResolvedValue([{ userId: OWNER, photos: [{ _id: 'p1', minioFileId: 'file-1' }] }]);
      mockedGetSignedUrlsBatch.mockRejectedValue(new Error('file-service down'));

      const result = await getCollageWithPhotos(collageId, OWNER);

      expect(result.photos[0]).toMatchObject({ _id: 'p1' });
      expect(result.photos[0].signedUrl).toBeUndefined();
    });
  });
});
