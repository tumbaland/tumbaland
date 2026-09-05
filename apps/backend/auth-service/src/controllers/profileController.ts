import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '@tumbaland/backend-core';
import { User } from '../models/User';

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
    picture: req.user.picture,
    lastLoginAt: dbUser.lastLoginAt,
    // Carried so the account page can show a standing request rather than
    // offering to make one that already exists.
    deletionRequestedAt: dbUser.deletionRequestedAt ?? null
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

  const { firstName, lastName } = req.body;

  // Update the user in database - handle empty strings explicitly
  const updateData: Partial<Record<'firstName' | 'lastName', string | null>> = {};
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
      picture: req.user.picture // Keep original picture from JWT
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
