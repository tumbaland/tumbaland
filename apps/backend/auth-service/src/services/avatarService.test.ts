jest.mock('../models/Avatar', () => ({
  Avatar: { updateOne: jest.fn(), deleteOne: jest.fn(), findOne: jest.fn() }
}));
jest.mock('../models/User', () => ({
  User: { findByIdAndUpdate: jest.fn() }
}));

import { Avatar } from '../models/Avatar';
import { User } from '../models/User';
import { MAX_AVATAR_BYTES, avatarUrl, effectivePicture, loadAvatar, removeAvatar, saveAvatar } from './avatarService';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const updateUser = User.findByIdAndUpdate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  updateUser.mockResolvedValue({ picture: 'x' });
});

describe('effectivePicture', () => {
  it('prefers an uploaded picture over Google’s', () => {
    expect(effectivePicture({ picture: 'mine', googlePicture: 'google' })).toBe('mine');
  });

  it('falls back to Google’s, then to nothing', () => {
    expect(effectivePicture({ picture: null, googlePicture: 'google' })).toBe('google');
    expect(effectivePicture({})).toBeUndefined();
  });
});

describe('avatarUrl', () => {
  it('is a new URL for each version, so a cached old picture is never shown', () => {
    expect(avatarUrl('abc', 1)).not.toBe(avatarUrl('abc', 2));
    expect(avatarUrl('abc', 1)).toMatch(/\/auth\/avatars\/abc\?v=/);
  });
});

describe('saveAvatar', () => {
  it.each([
    ['JPEG', jpeg, 'image/jpeg'],
    ['PNG', png, 'image/png'],
    ['WebP', webp, 'image/webp']
  ])('stores a %s under the type its bytes say', async (_name, bytes, type) => {
    const url = await saveAvatar('u1', bytes);

    expect(Avatar.updateOne).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { data: bytes, contentType: type } },
      { upsert: true }
    );
    expect(updateUser).toHaveBeenCalledWith('u1', { $set: { picture: url } }, { new: true });
  });

  it('refuses anything that is not really an image, whatever it claims', async () => {
    // Served back to every member's browser, so an SVG or HTML page must not get in.
    await expect(saveAvatar('u1', Buffer.from('<svg onload="alert(1)"/>'))).rejects.toThrow('not a JPEG');
    expect(Avatar.updateOne).not.toHaveBeenCalled();
  });

  it('refuses an empty body and one that was not parsed as bytes', async () => {
    await expect(saveAvatar('u1', Buffer.alloc(0))).rejects.toThrow();
    await expect(saveAvatar('u1', {})).rejects.toThrow();
  });

  it('refuses a picture over the size limit', async () => {
    const huge = Buffer.concat([jpeg, Buffer.alloc(MAX_AVATAR_BYTES)]);
    await expect(saveAvatar('u1', huge)).rejects.toThrow('too large');
  });
});

describe('removeAvatar', () => {
  it('deletes the upload and hands back Google’s picture', async () => {
    updateUser.mockResolvedValue({ picture: null, googlePicture: 'google' });

    expect(await removeAvatar('u1')).toBe('google');
    expect(Avatar.deleteOne).toHaveBeenCalledWith({ userId: 'u1' });
  });
});

describe('loadAvatar', () => {
  it('does not query for an id that could not be a user', async () => {
    expect(await loadAvatar('../etc/passwd')).toBeNull();
    expect(Avatar.findOne).not.toHaveBeenCalled();
  });

  it('returns the stored bytes and type', async () => {
    (Avatar.findOne as jest.Mock).mockResolvedValue({ data: jpeg, contentType: 'image/jpeg' });

    expect(await loadAvatar('64f2a0c1e4b0a1b2c3d4e5f6')).toEqual({ data: jpeg, contentType: 'image/jpeg' });
  });
});
