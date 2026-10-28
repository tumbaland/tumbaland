import { Types } from 'mongoose';
import { BadRequestError } from '@tumbaland/backend-core';
import type { IMessage } from '../models/Message';

/** Joins the two halves of a paging cursor; an ObjectId is hex, so it never contains this. */
const CURSOR_SEPARATOR = '_';

export const cursorOf = (message: Pick<IMessage, 'createdAt' | '_id'>): string =>
  `${message.createdAt.toISOString()}${CURSOR_SEPARATOR}${message._id.toString()}`;

/**
 * A cursor as a time and, when it carries one, the message id that breaks a tie.
 * A bare timestamp is still accepted: it is what clients sent before ids joined
 * the cursor, and what the stream's replay on reconnect sends.
 */
export function parseCursor(value: string, field: string): { at: Date; id: Types.ObjectId | null } {
  const [time, id] = value.split(CURSOR_SEPARATOR);
  const at = new Date(time ?? '');
  if (Number.isNaN(at.getTime())) throw new BadRequestError(`${field} is not a date`);
  if (id !== undefined && !Types.ObjectId.isValid(id)) throw new BadRequestError(`${field} is not a cursor`);
  return { at, id: id === undefined ? null : new Types.ObjectId(id) };
}
