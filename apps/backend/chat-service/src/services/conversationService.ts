import { Conversation, IConversation, IConversationMember } from '../models/Conversation';
import { Message } from '../models/Message';
import { ReadState } from '../models/ReadState';
import type { Caller } from './accessService';
import { photoAlbumView, type PhotoAlbumView } from './photoAlbumService';
import { appearanceView, type AppearanceView } from './appearanceService';

export interface ConversationSummary {
  id: string;
  groupId: string;
  title: string;
  members: IConversationMember[];
  lastMessageAt: Date | null;
  lastMessagePreview: string;
  lastMessageSender: string;
  unreadCount: number;
  createdAt: Date;
}

/**
 * Creates the conversation for a group, or returns the one that already
 * exists.
 *
 * An atomic upsert, not a find followed by a create. The client calls this on
 * first open rather than checking first, so two phones opening the app in the
 * same second both see nothing and both insert; only the unique
 * `{ groupId, title }` index can decide that race. `$setOnInsert` means the
 * loser reads the winner's row instead of overwriting the creator with itself.
 */
export async function ensureConversation(person: Caller, groupId: string, title = ''): Promise<IConversation> {
  const conversation = await Conversation.findOneAndUpdate(
    { groupId, title },
    {
      $setOnInsert: {
        groupId,
        title,
        createdBy: person.email,
        createdById: person.id,
        members: [{ userId: person.id, email: person.email, name: person.name, joinedAt: new Date() }]
      }
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return recordMember(conversation, person);
}

/**
 * Notes that this person has been seen in this conversation.
 *
 * The roster exists so offline push has somewhere to send; it is never an
 * access check, so adding to it can only affect who gets told, not who may
 * read. Someone in the group who has never opened the app is simply absent,
 * which costs nothing: they have no push subscription either.
 */
export async function recordMember(conversation: IConversation, person: Caller): Promise<IConversation> {
  const known = conversation.members.find((member) => member.userId === person.id);
  const picture = person.picture ?? null;
  if (known) {
    // Keep the display name and picture current without a write on every request.
    if (known.name === person.name && (known.picture ?? null) === picture) return conversation;
    await Conversation.updateOne(
      { _id: conversation._id, 'members.userId': person.id },
      { $set: { 'members.$.name': person.name, 'members.$.email': person.email, 'members.$.picture': picture } }
    );
    known.name = person.name;
    known.email = person.email;
    known.picture = picture;
    return conversation;
  }

  const member: IConversationMember = {
    userId: person.id,
    email: person.email,
    name: person.name,
    picture,
    joinedAt: new Date()
  };
  // Guarded on the userId being absent, so two concurrent first requests from
  // the same person cannot add them twice.
  await Conversation.updateOne(
    { _id: conversation._id, 'members.userId': { $ne: person.id } },
    { $push: { members: member } }
  );
  conversation.members.push(member);
  return conversation;
}

/**
 * Makes sure the caller has a conversation in each of their groups, then
 * returns the lot.
 *
 * This is what the app calls on open. Chat is group-scoped, and a group having
 * been created in Groups does not by itself create anywhere to talk: without
 * this the conversation list is empty forever and there is no way in.
 *
 * The group ids come from `req.userGroups`, never from the client, so the
 * caller cannot conjure a conversation in a group they are not in. Every
 * create is idempotent through the unique `{ groupId, title }` index, which is
 * what makes it safe to call on every launch and from two phones at once.
 */
export async function ensureConversationsForCaller(person: Caller): Promise<ConversationSummary[]> {
  // Sequential rather than parallel: the common case is one group, and a
  // burst of upserts against one index buys nothing worth the contention.
  for (const groupId of person.groups) {
    await ensureConversation(person, groupId);
  }
  return listConversations(person);
}

/**
 * The caller's conversations, newest activity first, each with its unread
 * count.
 *
 * Scoped by the groups the *token* says they are in. The roster on the
 * conversation is not consulted: it is a record of who has visited, and using
 * it to decide what someone may list would let a removed group member keep
 * seeing the thread.
 */
export async function listConversations(person: Caller): Promise<ConversationSummary[]> {
  if (person.groups.length === 0) return [];

  const conversations = await Conversation.find({
    groupId: { $in: person.groups },
    deletedAt: null
  })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(100);

  if (conversations.length === 0) return [];

  const ids = conversations.map((conversation) => conversation._id.toString());
  const readStates = await ReadState.find({ conversationId: { $in: ids }, userId: person.id });
  const readAt = new Map(readStates.map((state) => [state.conversationId, state.lastReadAt]));

  // One count for every conversation rather than one query each. Each
  // conversation carries its own cutoff, so the match is an `$or` of
  // per-conversation clauses, which the `{ conversationId, createdAt }` index
  // serves one branch at a time. Own messages never count as unread: a message
  // is not news to its sender.
  const unreadRows = await Message.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        deletedAt: null,
        senderId: { $ne: person.id },
        // "Irja set photos to go to Rome" is not news worth a badge.
        kind: { $ne: 'system' },
        $or: ids.map((id) => ({ conversationId: id, createdAt: { $gt: readAt.get(id) ?? new Date(0) } }))
      }
    },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } }
  ]);
  const unread = new Map(unreadRows.map((row) => [row._id, row.count]));

  return conversations.map((conversation) => {
    const id = conversation._id.toString();
    return {
      id,
      groupId: conversation.groupId,
      title: conversation.title ?? '',
      members: conversation.members,
      lastMessageAt: conversation.lastMessageAt ?? null,
      lastMessagePreview: conversation.lastMessagePreview ?? '',
      lastMessageSender: conversation.lastMessageSender ?? '',
      unreadCount: unread.get(id) ?? 0,
      createdAt: conversation.createdAt
    };
  });
}

/** How far one member has read, for the "seen" marker under a message. */
export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date;
}

/**
 * One conversation as the thread page opens it: who is in it, with their
 * pictures, and how far each of the others has read.
 *
 * The read positions are what let the page mark a message as seen from the
 * moment it opens. The stream only reports reads as they happen, so without
 * these the marker would be missing until the other person read something new.
 */
export async function conversationDetail(
  person: Caller,
  conversation: IConversation
): Promise<{
  id: string;
  groupId: string;
  title: string;
  members: IConversationMember[];
  reads: ReadReceipt[];
  photoAlbum: PhotoAlbumView;
  appearance: AppearanceView;
}> {
  const id = conversation._id.toString();
  const states = await ReadState.find({ conversationId: id, userId: { $ne: person.id } });

  return {
    id,
    groupId: conversation.groupId,
    title: conversation.title ?? '',
    members: conversation.members,
    reads: states.map((state) => ({
      userId: state.userId,
      lastReadMessageId: state.lastReadMessageId ?? null,
      lastReadAt: state.lastReadAt
    })),
    photoAlbum: photoAlbumView(conversation.photoAlbum),
    appearance: await appearanceView(conversation.appearance)
  };
}

/**
 * Unread across every conversation: the total for the shell's nav badge, and
 * each conversation's own count for the service worker, which checks a push is
 * still news before showing it.
 */
export async function unreadCounts(
  person: Caller
): Promise<{ unread: number; conversations: Record<string, number> }> {
  const summaries = await listConversations(person);
  return {
    unread: summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    conversations: Object.fromEntries(summaries.map((summary) => [summary.id, summary.unreadCount]))
  };
}

/**
 * Keeps the conversation-list preview in step with the thread. Called after
 * every send; a separate write rather than part of the message insert, because
 * a failed preview update must not lose the message.
 */
export async function touchConversation(
  conversationId: string,
  preview: string,
  senderName: string,
  at: Date
): Promise<void> {
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessageAt: at, lastMessagePreview: preview.slice(0, 200), lastMessageSender: senderName } }
  );
}
