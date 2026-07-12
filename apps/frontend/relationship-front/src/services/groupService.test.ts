import { vi } from 'vitest';
import { getUserGroups } from './groupService';

it('reads user groups from the configured group-service url', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [{ _id: 'g1', name: 'Family' }] })
  } as Response);

  const result = await getUserGroups();

  expect(result).toEqual([{ _id: 'g1', name: 'Family' }]);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/api/groups/mine');
});
