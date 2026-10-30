import { IAttachment, ICollageCard, IMessage, IPlanCard, IQuote, MessageEffect } from '../models/Message';
import { attachmentNoun } from './attachmentService';

/**
 * An attachment as the client receives it: the stored record plus signed URLs,
 * minted per response because they expire.
 */
export interface AttachmentView extends IAttachment {
  url?: string | null;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
}

/** The wire shape. Mongoose documents carry `__v` and internals the client has no use for. */
export interface MessageView {
  id: string;
  conversationId: string;
  senderEmail: string;
  senderId: string;
  senderName: string;
  kind: string;
  body: string;
  attachments: AttachmentView[];
  replyTo: string | null;
  quote: IQuote | null;
  effect: MessageEffect | null;
  collage: ICollageCard | null;
  plan: IPlanCard | null;
  /** The assistant that wrote it, if one did. */
  botId: string | null;
  reactions: Array<{ userId: string; name: string; emoji: string; at: Date }>;
  clientId: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export function toView(document: IMessage): MessageView {
  // Attachments and reactions are Mongoose subdocuments. Convert before
  // enriching them: spreading a subdocument copies internals, not its fields.
  const message = document.toObject();
  return {
    id: message._id.toString(),
    conversationId: message.conversationId,
    senderEmail: message.senderEmail,
    senderId: message.senderId,
    senderName: message.senderName,
    kind: message.kind,
    // A deleted message keeps its place in the thread but gives up its content.
    // Blanking here rather than at delete time means an edit history or an
    // undelete stays possible without a migration.
    body: message.deletedAt ? '' : message.body,
    attachments: message.deletedAt ? [] : message.attachments,
    replyTo: message.replyTo ?? null,
    quote: message.deletedAt ? null : (message.quote ?? null),
    effect: message.deletedAt ? null : (message.effect ?? null),
    collage: message.deletedAt ? null : (message.collage ?? null),
    plan: message.deletedAt ? null : (message.plan ?? null),
    botId: message.botId ?? null,
    reactions: message.deletedAt ? [] : message.reactions,
    clientId: message.clientId,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    createdAt: message.createdAt
  };
}

/** Longest quote a reply keeps of the message it answers. */
const QUOTE_LENGTH = 200;

/** What a reply shows of `message`: a line of its text, or what it carried. */
export function quoteText(message: Pick<IMessage, 'body' | 'attachments' | 'collage' | 'plan' | 'deletedAt'>): string {
  if (message.deletedAt) return '';
  if (message.collage) return `Collage: ${message.collage.title}`;
  if (message.plan) return `Reminder: ${message.plan.title}`;
  return preview(message.body, message.attachments).slice(0, QUOTE_LENGTH);
}

/** A one-line summary for the conversation list. */
export function preview(body: string, attachments: IAttachment[]): string {
  if (body.trim()) return body.trim();
  if (attachments.length === 0) return '';
  if (attachments.length === 1) return attachmentNoun(attachments[0]!);
  return `${attachments.length} attachments`;
}
