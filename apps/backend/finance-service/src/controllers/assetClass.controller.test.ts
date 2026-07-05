import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../models/AssetClass', () => {
  const MockAssetClass: any = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: 'new-asset-class-id', ...data })
  }));
  MockAssetClass.find = jest.fn();
  MockAssetClass.findById = jest.fn();
  MockAssetClass.findByIdAndDelete = jest.fn();
  MockAssetClass.findByIdAndUpdate = jest.fn();
  return { __esModule: true, default: MockAssetClass };
});

import AssetClass from '../models/AssetClass';
import app from '../app';

const mockedFind = AssetClass.find as unknown as jest.Mock;
const mockedFindById = AssetClass.findById as unknown as jest.Mock;
const mockedFindByIdAndDelete = AssetClass.findByIdAndDelete as unknown as jest.Mock;
const mockedFindByIdAndUpdate = AssetClass.findByIdAndUpdate as unknown as jest.Mock;

function sortResolvedWith(result: unknown) {
  return { sort: jest.fn().mockResolvedValue(result) };
}

function authCookie(groups: string[] = []) {
  const token = jwt.sign({ id: 'user-1', email: 'user@example.com', name: 'Test User', groups }, 'test-secret');
  return `access_token=${token}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/asset-classes', () => {
  it('rejects requests with no access token', async () => {
    const res = await request(app).get('/api/asset-classes');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token required' });
  });

  it('returns only personal asset classes when no groupId is given', async () => {
    mockedFind.mockReturnValue(sortResolvedWith([{ _id: 'ac-1', name: 'Stocks', userId: 'user-1' }]));

    const res = await request(app).get('/api/asset-classes').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ _id: 'ac-1', name: 'Stocks', userId: 'user-1' }] });
    expect(mockedFind).toHaveBeenCalledWith({ userId: 'user-1', groupId: { $exists: false } });
  });

  it('rejects a groupId the user is not a member of', async () => {
    const res = await request(app)
      .get('/api/asset-classes')
      .query({ groupId: 'group-1' })
      .set('Cookie', authCookie([]));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'ForbiddenError', message: 'Access denied' });
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('returns group asset classes when the user is a member', async () => {
    mockedFind.mockReturnValue(sortResolvedWith([{ _id: 'ac-2', name: 'Bonds', groupId: 'group-1' }]));

    const res = await request(app)
      .get('/api/asset-classes')
      .query({ groupId: 'group-1' })
      .set('Cookie', authCookie(['group-1']));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ _id: 'ac-2', name: 'Bonds', groupId: 'group-1' }] });
    expect(mockedFind).toHaveBeenCalledWith({ groupId: 'group-1' });
  });
});

describe('POST /api/asset-classes', () => {
  it('rejects a body that fails validation', async () => {
    const res = await request(app)
      .post('/api/asset-classes')
      .set('Cookie', authCookie())
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates an asset class tagged with the authenticated user', async () => {
    const res = await request(app)
      .post('/api/asset-classes')
      .set('Cookie', authCookie())
      .send({ name: 'Real Estate' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Asset class created successfully',
      data: { name: 'Real Estate', userId: 'user-1' }
    });
  });
});

describe('PUT /api/asset-classes/:id', () => {
  it('returns 404 when the asset class does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/asset-classes/missing-id')
      .set('Cookie', authCookie())
      .send({ name: 'Renamed' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NotFoundError', message: 'Asset class not found' });
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects updates from a user with no access to the asset class', async () => {
    mockedFindById.mockResolvedValue({ _id: 'ac-3', userId: 'someone-else', groupId: undefined });

    const res = await request(app)
      .put('/api/asset-classes/ac-3')
      .set('Cookie', authCookie())
      .send({ name: 'Renamed' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: 'ForbiddenError', message: 'Access denied' });
    expect(mockedFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates an asset class the user owns', async () => {
    mockedFindById.mockResolvedValue({ _id: 'ac-4', userId: 'user-1', groupId: undefined });
    mockedFindByIdAndUpdate.mockResolvedValue({ _id: 'ac-4', userId: 'user-1', name: 'Renamed' });

    const res = await request(app)
      .put('/api/asset-classes/ac-4')
      .set('Cookie', authCookie())
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Asset class updated successfully',
      data: { _id: 'ac-4', userId: 'user-1', name: 'Renamed' }
    });
  });
});

describe('DELETE /api/asset-classes/:id', () => {
  it('returns 404 when the asset class does not exist', async () => {
    mockedFindById.mockResolvedValue(null);

    const res = await request(app).delete('/api/asset-classes/missing-id').set('Cookie', authCookie());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NotFoundError', message: 'Asset class not found' });
    expect(mockedFindByIdAndDelete).not.toHaveBeenCalled();
  });

  it('deletes an asset class the user has group access to', async () => {
    mockedFindById.mockResolvedValue({ _id: 'ac-5', userId: 'someone-else', groupId: 'group-1' });
    mockedFindByIdAndDelete.mockResolvedValue({ _id: 'ac-5' });

    const res = await request(app)
      .delete('/api/asset-classes/ac-5')
      .set('Cookie', authCookie(['group-1']))
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Asset class deleted successfully' });
    expect(mockedFindByIdAndDelete).toHaveBeenCalledWith('ac-5');
  });
});
