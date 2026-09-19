import { Request, Response } from 'express';

jest.mock('./collage.service', () => ({
  createCollage: jest.fn(),
  updateCollage: jest.fn(),
  getCollageWithPhotos: jest.fn(),
  getCollageList: jest.fn(),
  deleteCollage: jest.fn()
}));

import * as collageService from './collage.service';
import { createCollage, updateCollage, getCollageById, getCollageList, deleteCollage } from './collage.controller';

const mocked = collageService as jest.Mocked<typeof collageService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('createCollage', () => {
  it('creates the collage and returns 201', async () => {
    mocked.createCollage.mockResolvedValue({ _id: 'c1' } as any);
    const res = mockRes();

    await createCollage(baseReq({ body: { title: 'Trip' } }), res);

    expect(mocked.createCollage).toHaveBeenCalledWith({ title: 'Trip' }, 'user-1', []);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updateCollage', () => {
  it('updates the collage', async () => {
    mocked.updateCollage.mockResolvedValue({ _id: 'c1', title: 'New' } as any);
    const res = mockRes();

    await updateCollage(baseReq({ params: { id: 'c1' }, body: { title: 'New' } }), res);

    expect(mocked.updateCollage).toHaveBeenCalledWith('c1', { title: 'New' }, 'user-1', []);
  });
});

describe('getCollageById', () => {
  it('returns collage + photos', async () => {
    mocked.getCollageWithPhotos.mockResolvedValue({ collage: { _id: 'c1' }, photos: [] } as any);
    const res = mockRes();

    await getCollageById(baseReq({ params: { id: 'c1' } }), res);

    expect(mocked.getCollageWithPhotos).toHaveBeenCalledWith('c1', 'user-1', []);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { collage: { _id: 'c1' }, photos: [] } }));
  });
});

describe('getCollageList', () => {
  it('passes albumId/groupId query filters through', async () => {
    mocked.getCollageList.mockResolvedValue([{ _id: 'c1' }] as any);
    const res = mockRes();

    await getCollageList(baseReq({ query: { albumId: 'a1', groupId: 'g1' } }), res);

    expect(mocked.getCollageList).toHaveBeenCalledWith('a1', 'user-1', [], 'g1');
  });
});

describe('deleteCollage', () => {
  it('deletes the collage', async () => {
    mocked.deleteCollage.mockResolvedValue(undefined);
    const res = mockRes();

    await deleteCollage(baseReq({ params: { id: 'c1' } }), res);

    expect(mocked.deleteCollage).toHaveBeenCalledWith('c1', 'user-1', []);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
