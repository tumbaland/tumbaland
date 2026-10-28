import type { IConversation } from '../models/Conversation';
import type { Caller } from './accessService';
import { publishToGroup } from './streamHub';

/** Announces a read cursor to the other members, so their ticks update. */
export function publishRead(conversation: IConversation, person: Caller, lastReadMessageId?: string): void {
  publishToGroup(conversation.groupId, {
    type: 'read',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: {
      userId: person.id,
      name: person.name,
      lastReadMessageId: lastReadMessageId ?? null,
      lastReadAt: new Date().toISOString()
    }
  });
}

/**
 * Typing is fire-and-forget: fanned out, never stored. A dropped typing event
 * costs nothing and storing them would be a write per keystroke burst.
 */
export function publishTyping(conversation: IConversation, person: Caller): void {
  publishToGroup(
    conversation.groupId,
    {
      type: 'typing',
      conversationId: conversation._id.toString(),
      at: Date.now(),
      payload: { userId: person.id, name: person.name }
    },
    // Nobody needs their own typing indicator echoed back at them.
    person.id
  );
}
