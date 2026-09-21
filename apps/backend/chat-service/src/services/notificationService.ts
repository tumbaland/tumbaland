import { logger } from '@tumbaland/backend-core';
import { IConversation } from '../models/Conversation';
import { ReadState } from '../models/ReadState';
import type { Caller } from './accessService';
import { MessageView } from './messageService';
import { sendToUsers } from './pushService';
import { onlineInGroup } from './streamHub';

/**
 * How recently someone must have read the conversation to count as "looking at
 * it right now".
 *
 * Someone with the thread open has a live stream, which is the first check.
 * This is the second: a phone that has just backgrounded still has the app in
 * memory and the person is plainly present. Without it, two people typing at
 * each other get a buzz for every line.
 */
const RECENTLY_ACTIVE_MS = 30_000;

/**
 * Who should get a phone buzz for this message.
 *
 * Everyone on the conversation's roster except the sender, minus anyone with
 * the app open, minus anyone who was reading it seconds ago.
 */
export async function recipientsFor(
  conversation: IConversation,
  sender: Caller
): Promise<Array<{ userId: string; name: string }>> {
  const candidates = conversation.members.filter((member) => member.userId !== sender.id);
  if (candidates.length === 0) return [];

  const online = onlineInGroup(conversation.groupId);
  const offline = candidates.filter((member) => !online.has(member.userId));
  if (offline.length === 0) return [];

  const cutoff = new Date(Date.now() - RECENTLY_ACTIVE_MS);
  const recent = await ReadState.find({
    conversationId: conversation._id.toString(),
    userId: { $in: offline.map((member) => member.userId) },
    lastReadAt: { $gt: cutoff }
  });
  const active = new Set(recent.map((state) => state.userId));

  return offline
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
    const recipients = await recipientsFor(conversation, sender);
    if (recipients.length === 0) return;

    await sendToUsers(
      recipients.map((recipient) => recipient.userId),
      {
        title: sender.name || 'New message',
        body: notificationBody(message),
        // One notification per conversation rather than one per message: ten
        // messages while the phone is in a pocket should be one buzz and one
        // line in the shade, not ten.
        tag: conversation._id.toString(),
        url: `/chat/${conversation._id.toString()}`
      }
    );
  } catch (error) {
    logger.warn('Chat notification failed', { error: (error as Error).message });
  }
}

/** What the notification says. Kept short: a lock screen truncates anyway. */
function notificationBody(message: MessageView): string {
  if (message.body.trim()) return message.body.trim().slice(0, 140);
  if (message.attachments.length === 0) return 'New message';

  const video = message.attachments.some((attachment) => attachment.mimetype.startsWith('video/'));
  if (message.attachments.length === 1) return video ? 'Sent a video' : 'Sent a photo';
  return `Sent ${message.attachments.length} attachments`;
}
