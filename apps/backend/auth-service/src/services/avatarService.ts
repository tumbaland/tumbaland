import { BadRequestError, NotFoundError } from '@tumbaland/backend-core';
import { Avatar } from '../models/Avatar';
import { User } from '../models/User';

/**
 * The largest picture accepted. The account page sends a 256px JPEG, which
 * is a few tens of kilobytes; this leaves room for a detailed photo without
 * letting anyone store a camera original in the user database.
 */
export const MAX_AVATAR_BYTES = 256 * 1024;

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Where other origins fetch the picture from. The same host the frontends call. */
const publicBaseUrl = (): string =>
  (process.env.AUTH_SERVICE_PUBLIC_URL || 'https://auth-api.tumbaland.eu').replace(/\/$/, '');

/**
 * The public URL for someone's uploaded picture.
 *
 * The version makes each upload a new URL, so the image can be cached forever
 * and a new picture still shows at once instead of after a cache expires.
 */
export const avatarUrl = (userId: string, version: number): string =>
  `${publicBaseUrl()}/auth/avatars/${userId}?v=${version.toString(36)}`;

/** The picture to show: an upload wins over the one from Google. */
export const effectivePicture = (user: { picture?: string | null; googlePicture?: string | null }): string | undefined =>
  user.picture || user.googlePicture || undefined;

/**
 * Checks the bytes really are the image they claim to be.
 *
 * The Content-Type header is the sender's word. These bytes are served back to
 * every member's browser, so the file's own signature decides, and anything
 * else — an SVG with script in it, an HTML page — is refused.
 */
function sniff(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Stores an uploaded picture and makes it the one shown. Returns its URL. */
export async function saveAvatar(userId: string, body: unknown): Promise<string> {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new BadRequestError('Send the picture as a JPEG, PNG or WebP image');
  }
  if (body.length > MAX_AVATAR_BYTES) {
    throw new BadRequestError('That picture is too large');
  }
  const contentType = sniff(body);
  if (!contentType) {
    throw new BadRequestError('That file is not a JPEG, PNG or WebP image');
  }

  await Avatar.updateOne({ userId }, { $set: { data: body, contentType } }, { upsert: true });

  const url = avatarUrl(userId, Date.now());
  const user = await User.findByIdAndUpdate(userId, { $set: { picture: url } }, { new: true });
  if (!user) throw new NotFoundError('User not found');
  return url;
}

/** Removes an uploaded picture. Whatever Google sent is shown again, if anything. */
export async function removeAvatar(userId: string): Promise<string | undefined> {
  await Avatar.deleteOne({ userId });
  const user = await User.findByIdAndUpdate(userId, { $set: { picture: null } }, { new: true });
  if (!user) throw new NotFoundError('User not found');
  return effectivePicture(user);
}

/** The stored picture, for the public image route. */
export async function loadAvatar(userId: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!/^[a-f0-9]{24}$/i.test(userId)) return null;
  // Not `lean()`: that hands back the driver's Binary wrapper, not a Buffer.
  const avatar = await Avatar.findOne({ userId });
  return avatar ? { data: avatar.data, contentType: avatar.contentType } : null;
}
