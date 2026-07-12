import { Request, Response } from 'express';

jest.mock('../services/activityType.service', () => ({
  createActivityType: jest.fn(),
  getActivityTypes: jest.fn(),
  getActivityTypeById: jest.fn(),
  updateActivityType: jest.fn(),
  deleteActivityType: jest.fn(),
  reorderActivityTypes: jest.fn()
}));

import * as ActivityTypeService from '../services/activityType.service';
import {
  createActivityType,
  getActivityTypes,
  getActivityTypeById,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from './activityType.controller';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('createActivityType', () => {
  it('generates a slug from the name when none is provided', async () => {
    (ActivityTypeService.createActivityType as jest.Mock).mockResolvedValue({ _id: 't1', slug: 'movie-night' });
    const req = { user: { id: 'u1' }, body: { name: 'Movie Night!' } } as unknown as Request;
    const res = mockRes();

    await createActivityType(req, res);

    expect(ActivityTypeService.createActivityType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Movie Night!', slug: 'movie-night', userId: 'u1' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('keeps a provided slug as-is', async () => {
    (ActivityTypeService.createActivityType as jest.Mock).mockResolvedValue({ _id: 't1' });
    const req = { user: { id: 'u1' }, body: { name: 'Movie Night!', slug: 'custom' } } as unknown as Request;

    await createActivityType(req, mockRes());

    expect(ActivityTypeService.createActivityType).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'custom' })
    );
  });
});

describe('getActivityTypes', () => {
  it('parses filters, coercing isActive and pagination', async () => {
    (ActivityTypeService.getActivityTypes as jest.Mock).mockResolvedValue({ types: [], total: 0, page: 1, totalPages: 0 });
    const req = {
      user: { id: 'u1' },
      userGroups: ['g1'],
      query: { isActive: 'false', limit: '5', page: '2', groupId: 'g1' }
    } as unknown as Request;

    await getActivityTypes(req, mockRes());

    expect(ActivityTypeService.getActivityTypes).toHaveBeenCalledWith({
      isActive: false,
      limit: 5,
      page: 2,
      groupId: 'g1',
      userId: 'u1',
      userGroupIds: ['g1']
    });
  });

  it('treats an empty-string or "null" groupId as personal context', async () => {
    (ActivityTypeService.getActivityTypes as jest.Mock).mockResolvedValue({ types: [], total: 0, page: 1, totalPages: 0 });
    const req = { user: { id: 'u1' }, query: { groupId: 'null' } } as unknown as Request;

    await getActivityTypes(req, mockRes());

    expect(ActivityTypeService.getActivityTypes).toHaveBeenCalledWith(expect.objectContaining({ groupId: null }));
  });

  it('omits groupId entirely when not present in the query at all', async () => {
    (ActivityTypeService.getActivityTypes as jest.Mock).mockResolvedValue({ types: [], total: 0, page: 1, totalPages: 0 });
    const req = { user: { id: 'u1' }, query: {} } as unknown as Request;

    await getActivityTypes(req, mockRes());

    const filters = (ActivityTypeService.getActivityTypes as jest.Mock).mock.calls[0][0];
    expect('groupId' in filters).toBe(false);
  });
});

describe('getActivityTypeById', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityTypeService.getActivityTypeById as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 't1' } } as unknown as Request;
    await expect(getActivityTypeById(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the type when found', async () => {
    (ActivityTypeService.getActivityTypeById as jest.Mock).mockResolvedValue({ _id: 't1' });
    const req = { params: { id: 't1' } } as unknown as Request;
    const res = mockRes();

    await getActivityTypeById(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 't1' } }));
  });
});

describe('updateActivityType', () => {
  it('throws NotFoundError when missing', async () => {
    (ActivityTypeService.updateActivityType as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: 't1' }, body: {} } as unknown as Request;
    await expect(updateActivityType(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the updated type', async () => {
    (ActivityTypeService.updateActivityType as jest.Mock).mockResolvedValue({ _id: 't1', name: 'New' });
    const req = { params: { id: 't1' }, body: { name: 'New' } } as unknown as Request;
    const res = mockRes();

    await updateActivityType(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 't1', name: 'New' } }));
  });
});

describe('deleteActivityType', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    (ActivityTypeService.deleteActivityType as jest.Mock).mockResolvedValue(false);
    const req = { params: { id: 't1' } } as unknown as Request;
    await expect(deleteActivityType(req, mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('confirms deletion', async () => {
    (ActivityTypeService.deleteActivityType as jest.Mock).mockResolvedValue(true);
    const req = { params: { id: 't1' } } as unknown as Request;
    const res = mockRes();

    await deleteActivityType(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Activity type deleted successfully' }));
  });
});

describe('reorderActivityTypes', () => {
  it('delegates to the service with typeIds/groupId', async () => {
    (ActivityTypeService.reorderActivityTypes as jest.Mock).mockResolvedValue(undefined);
    const req = { user: { id: 'u1' }, body: { typeIds: ['t1', 't2'], groupId: 'g1' } } as unknown as Request;
    const res = mockRes();

    await reorderActivityTypes(req, res);

    expect(ActivityTypeService.reorderActivityTypes).toHaveBeenCalledWith(['t1', 't2'], 'u1', 'g1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Activity types reordered successfully' }));
  });
});
