import { vi } from 'vite-plus/test';

vi.mock('./accountApi', () => ({
  accountApi: { put: vi.fn(), post: vi.fn(), delete: vi.fn() }
}));
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => ({ AUTH_SERVICE_URL: 'https://auth.example' })
}));

import { accountApi } from './accountApi';
import { profileService } from './profileService';

const api = accountApi as unknown as Record<'put' | 'post' | 'delete', ReturnType<typeof vi.fn>>;

afterEach(() => {
  vi.unstubAllGlobals();
});

it('PUTs profile updates to the auth-service profile endpoint', async () => {
  api.put.mockResolvedValue({ success: true, user: { id: 'u1' } });

  const result = await profileService.updateProfile({ firstName: 'Jane' });

  expect(accountApi.put).toHaveBeenCalledWith('/auth/profile', { firstName: 'Jane' });
  expect(result).toEqual({ success: true, user: { id: 'u1' } });
});

describe('account deletion', () => {
  it('records a deletion request', async () => {
    api.post.mockResolvedValue({ success: true });

    await expect(profileService.requestDeletion()).resolves.toEqual({ success: true });

    expect(accountApi.post).toHaveBeenCalledWith('/auth/profile/deletion', {});
  });

  it('takes the request back', async () => {
    api.delete.mockResolvedValue({ success: true });

    await expect(profileService.cancelDeletion()).resolves.toEqual({ success: true });

    expect(accountApi.delete).toHaveBeenCalledWith('/auth/profile/deletion');
  });
});

describe('uploadPicture', () => {
  const image = new Blob(['bytes'], { type: 'image/png' });

  const respondWith = (ok: boolean, body: unknown) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('sends the image bytes to the auth service and returns the new picture', async () => {
    const fetchMock = respondWith(true, { picture: 'https://cdn.example/me.jpg' });

    await expect(profileService.uploadPicture(image)).resolves.toBe('https://cdn.example/me.jpg');

    expect(fetchMock).toHaveBeenCalledWith('https://auth.example/auth/profile/picture', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'image/png' },
      body: image
    });
  });

  it('calls an untyped blob a JPEG', async () => {
    const fetchMock = respondWith(true, { picture: 'p' });

    await profileService.uploadPicture(new Blob(['bytes']));

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'image/jpeg' });
  });

  it('passes on the server’s reason when it refuses', async () => {
    respondWith(false, { message: 'Picture too large' });

    await expect(profileService.uploadPicture(image)).rejects.toThrow('Picture too large');
  });

  it('falls back to a plain message when the reply is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('not json');
        }
      })
    );

    await expect(profileService.uploadPicture(image)).rejects.toThrow('Could not save the picture. Please try again.');
  });

  it('treats a success with no picture as a failure', async () => {
    respondWith(true, {});

    await expect(profileService.uploadPicture(image)).rejects.toThrow('Could not save the picture');
  });
});

describe('removePicture', () => {
  it('returns the Google picture that takes over', async () => {
    api.delete.mockResolvedValue({ picture: 'https://google.example/me.jpg' });

    await expect(profileService.removePicture()).resolves.toBe('https://google.example/me.jpg');

    expect(accountApi.delete).toHaveBeenCalledWith('/auth/profile/picture');
  });

  it('returns nothing when there is no other picture', async () => {
    api.delete.mockResolvedValue({ picture: null });
    await expect(profileService.removePicture()).resolves.toBeUndefined();

    api.delete.mockResolvedValue(undefined);
    await expect(profileService.removePicture()).resolves.toBeUndefined();
  });
});
