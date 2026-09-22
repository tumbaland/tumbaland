import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '@tumbaland/backend-core';
import { User } from '../models/User';
import { effectivePicture, loadAvatar, removeAvatar, saveAvatar } from '../services/avatarService';
import { renewSession } from '../services/sessionService';

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  // Get the full user data from database
  const dbUser = await User.findById(req.user.id);
  if (!dbUser) {
    throw new NotFoundError('User not found');
  }

  // Combine JWT user data with database user data
  const userResponse = {
    id: req.user.id,
    email: req.user.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    name: req.user.name,
    picture: effectivePicture(dbUser) ?? req.user.picture,
    // Whether there is an upload to remove. Google's picture cannot be.
    hasCustomPicture: Boolean(dbUser.picture),
    lastLoginAt: dbUser.lastLoginAt,
    // Carried so the account page can show a standing request rather than
    // offering to make one that already exists.
    deletionRequestedAt: dbUser.deletionRequestedAt ?? null,
    showMoney: dbUser.showMoney === true
  };

  res.json({
    success: true,
    user: userResponse,
    approved: dbUser.isApproved
  });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { firstName, lastName, showMoney } = req.body as { firstName?: string; lastName?: string; showMoney?: boolean };

  // Update the user in database - handle empty strings explicitly
  const updateData: Partial<Record<'firstName' | 'lastName', string | null>> & { showMoney?: boolean } = {};
  if (showMoney !== undefined) updateData.showMoney = showMoney;
  if (firstName !== undefined) {
    const trimmedFirstName = firstName.trim();
    updateData.firstName = trimmedFirstName === '' ? null : trimmedFirstName;
  }
  if (lastName !== undefined) {
    const trimmedLastName = lastName.trim();
    updateData.lastName = trimmedLastName === '' ? null : trimmedLastName;
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updateData },
    { new: true }
  );

  if (!updatedUser) {
    throw new NotFoundError('User not found');
  }

  // Return updated user info
  res.json({
    success: true,
    user: {
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: req.user.name, // Keep original name from JWT
      picture: effectivePicture(updatedUser) ?? req.user.picture,
      showMoney: updatedUser.showMoney === true
    }
  });
};

/**
 * Ask for the account to be removed.
 *
 * Records a request and changes nothing else. The account keeps signing in and
 * keeps working; an administrator removes the data by hand afterwards.
 *
 * Deliberately not a cascade. Deleting an account here means photos in object
 * storage, transactions, journal entries, group memberships and API keys across
 * five services — the kind of fan-out that half-succeeds quietly and leaves
 * orphans nobody notices for months. A queue an administrator works through is
 * slower and is actually finished when it says it is.
 *
 * Idempotent: asking twice keeps the first date, because that is the date the
 * request was made and re-clicking a button is not a second request.
 */
export const requestAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.deletionRequestedAt) {
    user.deletionRequestedAt = new Date();
    await user.save();
  }

  res.json({
    success: true,
    deletionRequestedAt: user.deletionRequestedAt,
    message: 'Account deletion requested. Nothing has been removed yet.'
  });
};

/**
 * Change your mind.
 *
 * The counterpart the request needs to be safe: the account goes on working
 * while a request stands, so somebody who clicked by mistake would otherwise
 * have to email an administrator about an account that looks entirely normal.
 * Clearing the field rather than setting a second flag keeps one thing to read.
 */
export const cancelAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { deletionRequestedAt: null } },
    { new: true }
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    deletionRequestedAt: null,
    message: 'Your account will not be deleted.'
  });
};

/**
 * Sets the person's picture from an uploaded image.
 *
 * The body is the image itself, not JSON: the account page has already cut it
 * to a 256px square. The session token is re-signed straight away so the new
 * picture shows everywhere on this device without waiting for a renewal;
 * other devices pick it up at theirs.
 */
export const updateProfilePicture = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const picture = await saveAvatar(req.user.id, req.body);
  await renewSession(req, res, { reissue: true });

  res.json({ success: true, picture });
};

/** Removes an uploaded picture, falling back to Google's if there is one. */
export const deleteProfilePicture = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const picture = await removeAvatar(req.user.id);
  await renewSession(req, res, { reissue: true });

  res.json({ success: true, picture: picture ?? null });
};

/**
 * Serves an uploaded picture.
 *
 * Public, like the Google picture URLs it sits beside: it is shown in `<img>`
 * tags on other origins and in notifications, none of which can attach a
 * session. The URL carries a version, so it is cached for good and a new
 * upload is a new URL.
 */
export const getAvatar = async (req: Request, res: Response): Promise<void> => {
  const avatar = await loadAvatar(req.params.userId as string);
  if (!avatar) {
    throw new NotFoundError('No picture');
  }

  res.set({
    'Content-Type': avatar.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // The bytes were checked on upload; this stops a browser second-guessing it.
    'X-Content-Type-Options': 'nosniff'
  });
  res.send(avatar.data);
};
