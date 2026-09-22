import { Request } from 'express';
import { Types } from 'mongoose';
import { ForbiddenError, NotFoundError, UnauthorizedError, canAccessResource } from '@tumbaland/backend-core';
import { Conversation, IConversation } from '../models/Conversation';
import { recordMember } from './conversationService';

/** The caller, as every handler needs them. */
export interface Caller {
  id: string;
  email: string;
  name: string;
  /** Profile picture URL from the session, if they have one. */
  picture?: string;
  groups: string[];
}

export function caller(req: Request): Caller {
  const user = req.user;
  if (!user?.id) {
    throw new UnauthorizedError('Access token required');
  }
  return {
    id: user.id,
    email: (user.email || '').toLowerCase(),
    name: user.name || '',
    picture: user.picture || undefined,
    groups: req.userGroups || []
  };
}

/**
 * The conversation, if this caller may see it.
 *
 * A bad id is a 404 rather than a 400: `ObjectId` casting throws on garbage,
 * and an attacker probing ids should not be able to tell a malformed one from a
 * real one they cannot reach.
 *
 * Group membership decides access, exactly as it does for albums and journal
 * entries. `memberEmails` on the conversation is a denormalised copy and is
 * deliberately *not* the check: it can lag behind a group change, and trusting
 * it would let someone removed from the group keep reading.
 */
export async function requireConversation(person: Caller, conversationId: string): Promise<IConversation> {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = await Conversation.findOne({ _id: conversationId, deletedAt: null });
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const allowed = canAccessResource(person.id, conversation.createdById, conversation.groupId, person.groups);
  if (!allowed) {
    throw new NotFoundError('Conversation not found');
  }

  // Seen here, so push has somewhere to reach them. Not an access grant: the
  // check above already happened, and the roster is never consulted for it.
  return recordMember(conversation, person);
}

/**
 * The group must be one the caller is in. Used where a `groupId` arrives in a
 * request body, which is never trusted on its own.
 */
export function requireGroupMembership(person: Caller, groupId: string): void {
  if (!person.groups.includes(groupId)) {
    throw new ForbiddenError('You are not a member of that group');
  }
}
