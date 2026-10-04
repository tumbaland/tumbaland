import { vi } from 'vite-plus/test';

vi.mock('./accountApi', () => ({
  accountApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

import { accountApi } from './accountApi';
import { deviceService } from './deviceService';

const mocked = accountApi as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

it('lists devices from auth-service', async () => {
  mocked.get.mockResolvedValue({ success: true, data: [{ id: 's1' }] });

  await expect(deviceService.list()).resolves.toEqual([{ id: 's1' }]);
  expect(mocked.get).toHaveBeenCalledWith('/auth/sessions');
});

it('signs out one device and says whether it was this one', async () => {
  mocked.delete.mockResolvedValue({ success: true, data: { signedOut: true } });

  await expect(deviceService.signOut('s1')).resolves.toBe(true);
  expect(mocked.delete).toHaveBeenCalledWith('/auth/sessions/s1');
});

it('signs out every other device and says how many', async () => {
  mocked.post.mockResolvedValue({ success: true, data: { revoked: 2 } });

  await expect(deviceService.signOutOthers()).resolves.toBe(2);
  expect(mocked.post).toHaveBeenCalledWith('/auth/sessions/revoke-others', {});
});
