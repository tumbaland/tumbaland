import { vi } from 'vitest';

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn()
}));

import { getGlobalConfig } from '../config/ConfigProvider';
import { groupService, getUserGroups, getUserGroupIds } from './groupService';

const mockedGetGlobalConfig = getGlobalConfig as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  global.fetch = vi.fn();
  mockedGetGlobalConfig.mockReturnValue({ GROUP_API_URL: 'https://groups.example' });
});

it('resolves its base URL from GROUP_API_URL when fetching the user\'s groups', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: [{ _id: 'group-1', name: 'Family' }] })
  } as Response);

  const groups = await getUserGroups();

  expect(groups).toEqual([{ _id: 'group-1', name: 'Family' }]);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toBe('https://groups.example/api/groups/mine');
});

it('resolves its base URL from GROUP_API_URL when fetching the user\'s group ids', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: ['group-1', 'group-2'] })
  } as Response);

  const ids = await getUserGroupIds();

  expect(ids).toEqual(['group-1', 'group-2']);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(String(url)).toContain('/api/groups/mine');
});

it('exposes the same functions on the legacy groupService object', () => {
  expect(groupService.getUserGroups).toBe(getUserGroups);
  expect(groupService.getUserGroupIds).toBe(getUserGroupIds);
});
