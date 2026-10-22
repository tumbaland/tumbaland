import { isDocumentType } from './documents';
import { isAudioType } from './voice';
import type { Message } from '../types';

/**
 * A message in one line, worded as the server words it: its text, or what it
 * carried. For the conversation list and for the quote above a reply.
 */
export function messageSummary(message: Pick<Message, 'body' | 'attachments' | 'collage' | 'plan'>): string {
  if (message.collage) return `Collage: ${message.collage.title}`;
  if (message.plan) return `Reminder: ${message.plan.title}`;
  if (message.body.trim()) return message.body.trim();
  if (message.attachments.length === 0) return '';
  const [only] = message.attachments;
  if (only && message.attachments.length === 1) {
    if (isAudioType(only.mimetype)) return 'Voice message';
    return isDocumentType(only.mimetype) ? 'Document' : only.mimetype.startsWith('video/') ? 'Video' : 'Photo';
  }
  return `${message.attachments.length} attachments`;
}
