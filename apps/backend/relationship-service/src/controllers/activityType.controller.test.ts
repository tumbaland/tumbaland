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

  it('refuses to create a type in a group the caller is not in', async () => {
    const req = { user: { id: 'u1' }, userGroups: [], body: { name: 'Hike', groupId: 'g-other' } } as unknown as Request;

    await expect(createActivityType(req, mockRes())).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(ActivityTypeService.createActivityType).not.toHaveBeenCalled();
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

/** A request from u1, who belongs to g1, naming type t1. */
const asU1 = (extra: Record<string, unknown> = {}) =>
  ({ user: { id: 'u1' }, userGroups: ['g1'], params: { id: 't1' }, body: {}, ...extra }) as unknown as Request;

const typeFound = (type: Record<string, unknown> | null) =>
  (ActivityTypeService.getActivityTypeById as jest.Mock).mockResolvedValue(type);

describe('getActivityTypeById', () => {
  it('throws NotFoundError when missing', async () => {
    typeFound(null);
    await expect(getActivityTypeById(asU1(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the type when found', async () => {
    typeFound({ _id: 't1', userId: 'u1' });
    const res = mockRes();

    await getActivityTypeById(asU1(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 't1', userId: 'u1' } }));
  });
});

describe('updateActivityType', () => {
  it('throws NotFoundError when missing', async () => {
    typeFound({ _id: 't1', userId: 'u1' });
    (ActivityTypeService.updateActivityType as jest.Mock).mockResolvedValue(null);
    await expect(updateActivityType(asU1(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('returns the updated type', async () => {
    typeFound({ _id: 't1', userId: 'u1' });
    (ActivityTypeService.updateActivityType as jest.Mock).mockResolvedValue({ _id: 't1', name: 'New' });
    const res = mockRes();

    await updateActivityType(asU1({ body: { name: 'New' } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 't1', name: 'New' } }));
  });

  it('refuses moving a type into a group the caller is not in', async () => {
    typeFound({ _id: 't1', userId: 'u1' });

    await expect(updateActivityType(asU1({ body: { groupId: 'g-other' } }), mockRes())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    expect(ActivityTypeService.updateActivityType).not.toHaveBeenCalled();
  });
});

describe('deleteActivityType', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    typeFound({ _id: 't1', userId: 'u1' });
    (ActivityTypeService.deleteActivityType as jest.Mock).mockResolvedValue(false);
    await expect(deleteActivityType(asU1(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('confirms deletion', async () => {
    typeFound({ _id: 't1', userId: 'u1' });
    (ActivityTypeService.deleteActivityType as jest.Mock).mockResolvedValue(true);
    const res = mockRes();

    await deleteActivityType(asU1(), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Activity type deleted successfully' }));
  });
});

describe("another account's type", () => {
  it.each([
    { what: 'a personal type of someone else', type: { _id: 't1', userId: 'u2' } },
    { what: 'a type in a group the caller is not in', type: { _id: 't1', userId: 'u2', groupId: 'g2' } }
  ])('answers as missing for $what, and changes nothing', async ({ type }) => {
    typeFound(type);

    await expect(getActivityTypeById(asU1(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(updateActivityType(asU1({ body: { name: 'Mine now' } }), mockRes())).rejects.toMatchObject({
      name: 'NotFoundError'
    });
    await expect(deleteActivityType(asU1(), mockRes())).rejects.toMatchObject({ name: 'NotFoundError' });

    expect(ActivityTypeService.updateActivityType).not.toHaveBeenCalled();
    expect(ActivityTypeService.deleteActivityType).not.toHaveBeenCalled();
  });

  it('lets a member of the group reach a group type', async () => {
    typeFound({ _id: 't1', userId: 'u2', groupId: 'g1' });
    (ActivityTypeService.deleteActivityType as jest.Mock).mockResolvedValue(true);

    await deleteActivityType(asU1(), mockRes());

    expect(ActivityTypeService.deleteActivityType).toHaveBeenCalledWith('t1');
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
