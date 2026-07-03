import { createGroupService } from './groupService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; statusText?: string } = {}) {
  const { ok = true, statusText = 'OK' } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    statusText,
    json: async () => body
  });
}

describe('createGroupService', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
  });

  const config = { getGroupApiUrl: () => 'https://groups.example' };

  describe('getUserGroups', () => {
    it('returns the group list on success', async () => {
      mockFetchOnce({ success: true, data: [{ _id: '1', name: 'Family' }] });
      const groupService = createGroupService(config);

      const groups = await groupService.getUserGroups();

      expect(groups).toEqual([{ _id: '1', name: 'Family' }]);
    });

    it('sends the localStorage token as a Bearer header', async () => {
      localStorage.setItem('authToken', 'my-jwt');
      mockFetchOnce({ success: true, data: [] });
      const groupService = createGroupService(config);

      await groupService.getUserGroups();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://groups.example/api/groups/mine',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-jwt' }) })
      );
    });

    it('throws when the response is not ok', async () => {
      mockFetchOnce({}, { ok: false, statusText: 'Unauthorized' });
      const groupService = createGroupService(config);

      await expect(groupService.getUserGroups()).rejects.toThrow('Failed to fetch groups: Unauthorized');
    });

    it('throws when the API reports success:false', async () => {
      mockFetchOnce({ success: false, message: 'nope' });
      const groupService = createGroupService(config);

      await expect(groupService.getUserGroups()).rejects.toThrow('nope');
    });
  });

  describe('getUserGroupIds', () => {
    it('returns the id list on success', async () => {
      mockFetchOnce({ success: true, data: ['1', '2'] });
      const groupService = createGroupService(config);

      const ids = await groupService.getUserGroupIds();

      expect(ids).toEqual(['1', '2']);
    });
  });
});
