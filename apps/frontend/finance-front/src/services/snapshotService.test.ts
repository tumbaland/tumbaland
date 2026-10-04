import { vi } from 'vite-plus/test';
import { getSnapshots, saveSnapshot, deleteSnapshot, snapshotMonth } from './snapshotService';
import { Snapshot } from '../types';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

describe('snapshotService', () => {
  it('fetches snapshots scoped to a group', async () => {
    mockFetchOnce({ success: true, data: [{ _id: 's1' }] });

    const result = await getSnapshots('group-1');

    expect(result).toEqual([{ _id: 's1' }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/snapshots?groupId=group-1');
  });

  it('fetches all snapshots when no group is given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getSnapshots();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });

  it('saves a snapshot for a month, including groupId when given', async () => {
    mockFetchOnce({ success: true, data: { _id: 's1', date: '2024-05-01' } });

    await saveSnapshot('2024-05', [{ assetClassId: 'ac1', value: 100, gain: 10 }], 'group-1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/snapshots/2024-05');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(init!.body as string)).toEqual({
      entries: [{ assetClassId: 'ac1', value: 100, gain: 10 }],
      groupId: 'group-1'
    });
  });

  it('omits groupId from the save payload when not given', async () => {
    mockFetchOnce({ success: true, data: { _id: 's1' } });

    await saveSnapshot('2024-05', []);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ entries: [] });
  });

  it('deletes a snapshot', async () => {
    mockFetchOnce({ success: true });
    await deleteSnapshot('s1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/snapshots/s1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('extracts the YYYY-MM month key from a snapshot date', () => {
    expect(snapshotMonth({ date: '2024-05-15T00:00:00.000Z' } as Snapshot)).toBe('2024-05');
  });
});
