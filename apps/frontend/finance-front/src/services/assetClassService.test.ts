import { vi } from 'vitest';
import { getAssetClasses, createAssetClass, updateAssetClass, deleteAssetClass } from './assetClassService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body
  } as Response);
}

describe('assetClassService', () => {
  it('fetches asset classes and unwraps the envelope', async () => {
    mockFetchOnce({ success: true, data: [{ _id: 'ac-1', name: 'Stocks' }] });

    const result = await getAssetClasses({ groupId: 'group-1' });

    expect(result).toEqual([{ _id: 'ac-1', name: 'Stocks' }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/asset-classes?groupId=group-1');
  });

  it('posts a new asset class and returns the created record', async () => {
    mockFetchOnce({ success: true, data: { _id: 'ac-2', name: 'Bonds' } });

    const result = await createAssetClass({ name: 'Bonds' });

    expect(result).toEqual({ _id: 'ac-2', name: 'Bonds' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'Bonds' }) });
  });

  it('updates an asset class via PUT', async () => {
    mockFetchOnce({ success: true, data: { _id: 'ac-3', name: 'Renamed' } });

    const result = await updateAssetClass('ac-3', { name: 'Renamed' });

    expect(result).toEqual({ _id: 'ac-3', name: 'Renamed' });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/asset-classes/ac-3');
    expect(init).toMatchObject({ method: 'PUT' });
  });

  it('propagates a non-ok response as a thrown ApiError', async () => {
    mockFetchOnce({ success: false, message: 'Not found' }, { ok: false, status: 404 });

    await expect(deleteAssetClass('missing-id')).rejects.toMatchObject({ status: 404, message: 'Not found' });
  });
});
