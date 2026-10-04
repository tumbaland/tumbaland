import { vi } from 'vite-plus/test';
import {
  getActivityTypes,
  getActivityTypeById,
  createActivityType,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from './activityTypes';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

describe('getActivityTypes', () => {
  it('builds params from filters and reshapes the backend envelope', async () => {
    mockFetchOnce({
      success: true,
      data: { types: [{ _id: 't1', name: 'Reading' }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } }
    });

    const result = await getActivityTypes({ isActive: true, limit: 50, page: 1, groupId: 'g1' });

    expect(result).toEqual({
      data: [{ _id: 't1', name: 'Reading' }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
    });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('isActive=true');
    expect(String(url)).toContain('groupId=g1');
  });

  it('sends an empty groupId when explicitly set to distinguish from omitted', async () => {
    mockFetchOnce({ success: true, data: { types: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } });
    await getActivityTypes({ groupId: '' });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('groupId=');
  });

  it('omits all filters when none are given', async () => {
    mockFetchOnce({ success: true, data: { types: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } });
    await getActivityTypes();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('?');
  });
});

describe('getActivityTypeById', () => {
  it('fetches a single activity type', async () => {
    mockFetchOnce({ success: true, data: { _id: 't1', name: 'Reading' } });
    const result = await getActivityTypeById('t1');
    expect(result).toEqual({ _id: 't1', name: 'Reading' });
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/activity-types/t1');
  });
});

describe('createActivityType', () => {
  it('POSTs the new type', async () => {
    mockFetchOnce({ success: true, data: { _id: 't1', name: 'Reading' } });
    const result = await createActivityType({ name: 'Reading' });
    expect(result).toEqual({ _id: 't1', name: 'Reading' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST' });
  });
});

describe('updateActivityType', () => {
  it('PUTs the update', async () => {
    mockFetchOnce({ success: true, data: { _id: 't1', name: 'Renamed' } });
    const result = await updateActivityType('t1', { name: 'Renamed' });
    expect(result).toEqual({ _id: 't1', name: 'Renamed' });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/activity-types/t1');
    expect(init).toMatchObject({ method: 'PUT' });
  });
});

describe('deleteActivityType', () => {
  it('DELETEs the type', async () => {
    mockFetchOnce({ success: true });
    await deleteActivityType('t1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/activity-types/t1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});

describe('reorderActivityTypes', () => {
  it('POSTs the new order with an optional groupId', async () => {
    mockFetchOnce({ success: true });
    await reorderActivityTypes(['t1', 't2'], 'g1');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ typeIds: ['t1', 't2'], groupId: 'g1' });
  });
});
