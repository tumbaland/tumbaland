import { logger } from '@tumbaland/backend-core';
import { Conversation } from '../models/Conversation';
import { IPlanCard, Message } from '../models/Message';
import type { Caller } from './accessService';
import { touchConversation } from './conversationService';
import { toView } from './messageView';
import { notifyNewMessage } from './notificationService';
import { planReminderPush, planReminderText } from './planText';
import { isPushConfigured, sendToUsers } from './pushService';
import { publishToGroup } from './streamHub';

/**
 * A plan from the journal is coming up: say so in the group's chat.
 *
 * The chat is where the unread badge and the phone notification already come
 * from, so a reminder is a message there rather than a second inbox. It is
 * posted by nobody in particular: the sender is Tumbaland itself, which is not
 * a member, so everyone in the chat gets it as unread and gets the push,
 * including whoever made the plan.
 */

/** The sender of every reminder. Not a user id; never a member of anything. */
export const REMINDER_SENDER: Caller = {
  id: 'tumbaland-reminders',
  email: 'reminders@tumbaland.eu',
  name: 'Reminder',
  groups: []
};

export interface PlanReminderInput {
  planId: string;
  groupId?: string;
  userId: string;
  title: string;
  date: string;
  endDate?: string;
  time?: string;
  timeZone: string;
  place?: string;
  remindAt: string;
}

/**
 * Posts the reminder card, or for a personal plan (no group, so no chat)
 * notifies its owner directly. Idempotent on the plan and its reminder time,
 * so a retry after a timeout does not post it twice.
 */
export async function postPlanReminder(input: PlanReminderInput): Promise<{ posted: boolean }> {
  const plan: IPlanCard = {
    id: input.planId,
    title: input.title,
    date: input.date,
    endDate: input.endDate ?? null,
    time: input.time ?? null,
    timeZone: input.timeZone,
    place: input.place ?? null
  };
  const url = `/relationship/journal?view=calendar&plan=${encodeURIComponent(input.planId)}`;

  const conversation = input.groupId
    ? await Conversation.findOne({ groupId: input.groupId, title: '', deletedAt: null })
    : null;

  // A personal plan, or a group whose chat nobody has opened yet: there is no
  // thread to post in, so the one person who certainly cares is told directly.
  if (!conversation) {
    if (isPushConfigured()) {
      await sendToUsers([input.userId], {
        title: 'Reminder',
        body: planReminderPush(plan),
        tag: `plan-${input.planId}`,
        url
      });
    }
    return { posted: false };
  }

  const conversationId = conversation._id.toString();
  const clientId = `plan-${input.planId}-${input.remindAt}`;
  let message;
  try {
    message = await Message.create({
      conversationId,
      senderEmail: REMINDER_SENDER.email,
      senderId: REMINDER_SENDER.id,
      senderName: REMINDER_SENDER.name,
      kind: 'reminder',
      body: planReminderText(plan),
      plan,
      clientId
    });
  } catch (error) {
    // The same reminder again, after a dropped response: it is already there.
    if ((error as { code?: number }).code === 11000) return { posted: true };
    throw error;
  }

  await touchConversation(conversationId, `Reminder: ${plan.title}`, REMINDER_SENDER.name, message.createdAt);
  const view = toView(message);
  publishToGroup(conversation.groupId, {
    type: 'message.created',
    conversationId,
    at: message.createdAt.getTime(),
    payload: view
  });
  void notifyNewMessage(conversation, REMINDER_SENDER, view).catch((error: Error) =>
    logger.warn('Reminder notification failed', { error: error.message })
  );
  return { posted: true };
}
