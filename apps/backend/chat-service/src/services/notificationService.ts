import { logger } from '@tumbaland/backend-core';
import { setTimeout as delay } from 'timers/promises';
import { IConversation } from '../models/Conversation';
import { ReadState } from '../models/ReadState';
import type { Caller } from './accessService';
import { attachmentNoun } from './attachmentService';
import { MessageView } from './messageService';
import { isPushConfigured, sendToUsers } from './pushService';

/**
 * Give the foreground thread time to acknowledge this message. Having a
 * stream open (possibly on another device) does not prove it was read.
 */
const READ_RECEIPT_GRACE_MS = 1500;

/**
 * Who should get a phone buzz for this message.
 *
 * Everyone except the sender and people who have read this message already.
 */
export async function recipientsFor(
  conversation: IConversation,
  sender: Caller,
  messageCreatedAt: Date
): Promise<Array<{ userId: string; name: string }>> {
  const candidates = conversation.members.filter((member) => member.userId !== sender.id);
  if (candidates.length === 0) return [];

  const recent = await ReadState.find({
    conversationId: conversation._id.toString(),
    userId: { $in: candidates.map((member) => member.userId) },
    lastReadAt: { $gte: messageCreatedAt }
  });
  const active = new Set(recent.map((state) => state.userId));

  return candidates
    .filter((member) => !active.has(member.userId))
    .map((member) => ({ userId: member.userId, name: member.name }));
}

/**
 * Sends the notification for a new message.
 *
 * Never awaited by the send path and never allowed to throw: the message is
 * already stored, and a push service being slow or down must not turn a
 * delivered message into a failed request. A dropped notification costs a buzz;
 * a failed send costs the message.
 */
export async function notifyNewMessage(
  conversation: IConversation,
  sender: Caller,
  message: MessageView
): Promise<void> {
  try {
    if (!isPushConfigured()) return;
    await delay(READ_RECEIPT_GRACE_MS);
    const recipients = await recipientsFor(conversation, sender, message.createdAt);
    if (recipients.length === 0) return;

    const conversationId = conversation._id.toString();
    await sendToUsers(
      recipients.map((recipient) => recipient.userId),
      {
        title: sender.name || 'New message',
        body: notificationBody(message),
        // One notification per conversation rather than one per message: ten
        // messages while the phone is in a pocket should be one buzz and one
        // line in the shade, not ten.
        tag: conversationId,
        url: `/chat/${conversationId}`,
        conversationId,
        sentAt: new Date(message.createdAt).getTime()
      },
      // The same collapsing, one step earlier: while a browser is closed its
      // push service holds only the newest push for each conversation. An
      // ObjectId is 24 hex characters, inside the Topic header's 32
      // base64url characters.
      { topic: conversationId }
    );
  } catch (error) {
    logger.warn('Chat notification failed', { error: (error as Error).message });
  }
}

/** What the notification says. Kept short: a lock screen truncates anyway. */
function notificationBody(message: MessageView): string {
  if (message.collage) return `Started a collage: ${message.collage.title}`;
  if (message.body.trim()) return message.body.trim().slice(0, 140);
  if (message.attachments.length === 0) return 'New message';

  if (message.attachments.length === 1) return `Sent a ${attachmentNoun(message.attachments[0]!).toLowerCase()}`;
  return `Sent ${message.attachments.length} attachments`;
}
