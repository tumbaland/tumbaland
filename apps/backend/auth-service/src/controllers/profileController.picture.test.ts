import { Request, Response } from 'express';

jest.mock('../services/avatarService', () => ({
  ...jest.requireActual('../services/avatarService'),
  saveAvatar: jest.fn(),
  removeAvatar: jest.fn(),
  loadAvatar: jest.fn()
}));
jest.mock('../services/sessionService', () => ({ renewSession: jest.fn() }));

import { loadAvatar, removeAvatar, saveAvatar } from '../services/avatarService';
import { renewSession } from '../services/sessionService';
import { deleteProfilePicture, getAvatar, updateProfilePicture } from './profileController';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
}

const authedReq = (body: unknown = Buffer.from([0xff, 0xd8, 0xff])) =>
  ({ user: { id: 'user-1', email: 'ada@example.com' }, body }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('updateProfilePicture', () => {
  it('stores the picture and re-signs the token so it shows at once', async () => {
    (saveAvatar as jest.Mock).mockResolvedValue('https://auth.example/auth/avatars/user-1?v=1');
    const res = mockRes();
    const req = authedReq();

    await updateProfilePicture(req, res);

    expect(saveAvatar).toHaveBeenCalledWith('user-1', req.body);
    expect(renewSession).toHaveBeenCalledWith(req, res, { reissue: true });
    expect(res.json).toHaveBeenCalledWith({ success: true, picture: 'https://auth.example/auth/avatars/user-1?v=1' });
  });

  it('does not re-sign anything when the picture is refused', async () => {
    (saveAvatar as jest.Mock).mockRejectedValue(new Error('not a JPEG'));

    await expect(updateProfilePicture(authedReq(), mockRes())).rejects.toThrow('not a JPEG');
    expect(renewSession).not.toHaveBeenCalled();
  });

  it('refuses a caller with no session', async () => {
    await expect(updateProfilePicture({ user: undefined } as unknown as Request, mockRes())).rejects.toThrow(
      'Not authenticated'
    );
  });
});

describe('deleteProfilePicture', () => {
  it('falls back to Google’s picture, or to none', async () => {
    (removeAvatar as jest.Mock).mockResolvedValue(undefined);
    const res = mockRes();

    await deleteProfilePicture(authedReq(), res);

    expect(renewSession).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, picture: null });
  });
});

describe('getAvatar', () => {
  it('serves the bytes with their type, cached for good', async () => {
    const data = Buffer.from([0xff, 0xd8, 0xff]);
    (loadAvatar as jest.Mock).mockResolvedValue({ data, contentType: 'image/jpeg' });
    const res = mockRes();

    await getAvatar({ params: { userId: '64f2a0c1e4b0a1b2c3d4e5f6' } } as unknown as Request, res);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' })
    );
    expect(res.send).toHaveBeenCalledWith(data);
  });

  it('answers 404 when there is no picture', async () => {
    (loadAvatar as jest.Mock).mockResolvedValue(null);

    await expect(getAvatar({ params: { userId: 'x' } } as unknown as Request, mockRes())).rejects.toThrow('No picture');
  });
});
