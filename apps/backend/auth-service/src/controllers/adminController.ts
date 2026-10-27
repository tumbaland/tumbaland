import { Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  actorOf,
  ApiKey,
  AuditEvent,
  ConflictError,
  ForbiddenError,
  logger,
  NotFoundError,
  revokeRefreshTokensForUser,
  sendSuccess
} from '@tumbaland/backend-core';
import { IUser, User } from '../models/User';
import { Session } from '../models/Session';

/**
 * Closing an account that asked to be deleted, and undoing it.
 *
 * These are the only administrator *writes* to a person's account, which is why
 * they live here, next to the model that owns it, and not in admin-service,
 * which only ever reads. Nothing is deleted. See `User.deletionConfirmedAt` for
 * the three states and why removal is a separate job.
 */

const findTarget = async (id: string): Promise<IUser> => {
  const user = Types.ObjectId.isValid(id) ? await User.findById(id) : null;
  if (!user) throw new NotFoundError('User not found');
  return user;
};

/**
 * One row in the trail, in the administrator's own account: it is a record of
 * what they did, and the trail is scoped to who acted. The closed person's
 * account is named in `resourceId`.
 *
 * Never allowed to fail the action it describes, for the reason every other
 * trail write isn't: the process log carries the same line.
 */
const recordAccountAudit = async (
  req: Request,
  action: 'confirm' | 'reopen',
  targetId: string,
  changes: Record<string, { from: unknown; to: unknown }>
): Promise<void> => {
  logger.info(`Account deletion ${action}`, { admin: req.user?.id, target: targetId });
  try {
    const actor = actorOf(req);
    if (!actor) return;
    await AuditEvent.create({
      at: new Date(),
      service: 'auth-service',
      action: 'update',
      resource: 'account',
      resourceId: targetId,
      actorKind: actor.kind,
      userId: actor.userId,
      actorLabel: actor.label,
      tenant: actor.tenant,
      changes
    });
  } catch (error) {
    logger.warn('Could not record the account audit row', { error: (error as Error)?.message });
  }
};

/**
 * Confirms a deletion request: the account is closed.
 *
 * Signed out everywhere (sessions deleted, token version bumped, so a token
 * already in a browser stops working at once), connected assistants cut off at
 * their refresh token, and API keys revoked. An access token an assistant
 * already holds keeps working until it expires, at most an hour: they are
 * stateless, and that is the trade made when they were.
 *
 * Refuses an administrator closing their own account. With one administrator
 * that would lock out the only person who can undo it.
 */
export const confirmDeletion = async (req: Request, res: Response): Promise<void> => {
  const user = await findTarget(String(req.params.id));
  const targetId = String(user._id);

  if (targetId === req.user?.id) {
    throw new ForbiddenError('You cannot close your own account from here');
  }
  if (user.deletionConfirmedAt) throw new ConflictError('This account is already closed');
  if (!user.deletionRequestedAt) throw new ConflictError('This account has not asked to be deleted');

  const now = new Date();
  // The preconditions again, in the filter: two administrators confirming at
  // once close it once, and a person who cancelled a moment ago is not closed.
  const closed = await User.findOneAndUpdate(
    { _id: user._id, deletionRequestedAt: { $ne: null }, deletionConfirmedAt: null },
    { $set: { deletionConfirmedAt: now, deletionConfirmedBy: req.user?.id }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  if (!closed) throw new ConflictError('The request changed while you were confirming it. Look at it again.');

  let sessions: { deletedCount: number };
  let connections: number;
  let keys: { modifiedCount: number };
  try {
    [sessions, connections, keys] = await Promise.all([
      Session.deleteMany({ userId: user._id }),
      revokeRefreshTokensForUser(targetId),
      ApiKey.updateMany({ userId: targetId, revokedAt: { $exists: false } }, { $set: { revokedAt: now } })
    ]);
  } catch (error) {
    // Closed but not cut off would be the worst state to leave: the queue shows
    // it as done, a retry is refused as "already closed", and the keys and
    // assistants go on working. Put the request back instead, so the
    // administrator sees an error and Close works again. Whatever was revoked
    // before the failure stays revoked, which is what was asked for anyway.
    await User.updateOne(
      { _id: user._id, deletionConfirmedAt: now },
      { $unset: { deletionConfirmedAt: '', deletionConfirmedBy: '' } }
    );
    logger.error('Account deletion confirm failed while cutting off access; the close was undone', {
      target: targetId,
      error: (error as Error)?.message
    });
    throw error;
  }

  await recordAccountAudit(req, 'confirm', targetId, {
    deletionConfirmedAt: { from: null, to: now.toISOString() }
  });

  sendSuccess(res, {
    id: targetId,
    email: closed.email,
    deletionRequestedAt: closed.deletionRequestedAt,
    deletionConfirmedAt: closed.deletionConfirmedAt,
    sessionsEnded: sessions.deletedCount,
    connectionsRevoked: connections,
    keysRevoked: keys.modifiedCount
  });
};

/**
 * Takes a confirmation back, for a mistake. The account can sign in again.
 *
 * The request is cleared with it, not left standing: someone reopened because
 * they should not have been closed does not belong in the queue a second time.
 * Keys and connections that were revoked stay revoked; the person makes them
 * again.
 */
export const reopenAccount = async (req: Request, res: Response): Promise<void> => {
  const user = await findTarget(String(req.params.id));
  const targetId = String(user._id);

  if (!user.deletionConfirmedAt) throw new ConflictError('This account is not closed');

  await User.updateOne(
    { _id: user._id },
    { $set: { deletionRequestedAt: null }, $unset: { deletionConfirmedAt: '', deletionConfirmedBy: '' } }
  );

  await recordAccountAudit(req, 'reopen', targetId, {
    deletionConfirmedAt: { from: user.deletionConfirmedAt.toISOString(), to: null }
  });

  sendSuccess(res, { id: targetId, email: user.email, deletionRequestedAt: null, deletionConfirmedAt: null });
};
