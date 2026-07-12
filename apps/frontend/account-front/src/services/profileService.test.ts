import { vi } from 'vitest';

vi.mock('./accountApi', () => ({
  accountApi: { put: vi.fn() }
}));

import { accountApi } from './accountApi';
import { profileService } from './profileService';

it('PUTs profile updates to the auth-service profile endpoint', async () => {
  (accountApi.put as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, user: { id: 'u1' } });

  const result = await profileService.updateProfile({ firstName: 'Jane' });

  expect(accountApi.put).toHaveBeenCalledWith('/auth/profile', { firstName: 'Jane' });
  expect(result).toEqual({ success: true, user: { id: 'u1' } });
});
