import { Conversation, type IConversation } from '../models/Conversation';
import { announce } from './botService';
import type { ClientTool } from './assistantClaude';

/**
 * What the assistants have noted about the people in a chat, and the two tools
 * they note it with.
 *
 * It is one plain text, a note to a line, and nothing else: that is what the
 * people in the chat see in the assistants dialog and can edit as they like, so
 * the assistants and the people are working on the very same page. The
 * assistants only ever add a line or take one away; they cannot rewrite it.
 */

/** The whole text. The same limit the dialog enforces on a person's edit. */
export const MEMORY_LIMIT = 1500;
export const NOTE_LIMIT = 200;

const lines = (memory: string): string[] => memory.split('\n').map((line) => line.trim()).filter(Boolean);
const tidy = (note: string): string => note.trim().replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ').trim();

export interface Change {
  memory: string;
  /** What the assistant is told happened, so it can say so to the people. */
  message: string;
  changed: boolean;
}

export function addNote(memory: string, raw: string): Change {
  const note = tidy(raw);
  if (!note) return { memory, changed: false, message: 'Nothing to note: the note was empty.' };
  if (note.length > NOTE_LIMIT) {
    return { memory, changed: false, message: `That is too long for a note (${NOTE_LIMIT} characters at most). Shorten it to one fact.` };
  }
  const existing = lines(memory);
  if (existing.some((line) => line.toLowerCase() === note.toLowerCase())) {
    return { memory, changed: false, message: 'That is already noted.' };
  }
  const next = [...existing, note].join('\n');
  if (next.length > MEMORY_LIMIT) {
    return { memory, changed: false, message: 'The notes are full. Tell the people to clear some space in the assistants dialog, or forget a note that is no longer true.' };
  }
  return { memory: next, changed: true, message: `Noted: ${note}` };
}

/** Takes away the one note that matches, never a guess among several. */
export function removeNote(memory: string, raw: string): Change {
  const wanted = tidy(raw).toLowerCase();
  if (!wanted) return { memory, changed: false, message: 'Nothing to forget: say which note.' };
  const existing = lines(memory);
  const exact = existing.filter((line) => line.toLowerCase() === wanted);
  const matches = exact.length ? exact : existing.filter((line) => line.toLowerCase().includes(wanted));
  if (matches.length === 0) return { memory, changed: false, message: 'No note matches that.' };
  if (matches.length > 1) {
    return { memory, changed: false, message: `More than one note matches. Say which: ${matches.map((line) => `"${line}"`).join(' or ')}.` };
  }
  return { memory: existing.filter((line) => line !== matches[0]).join('\n'), changed: true, message: `Forgot: ${matches[0]}` };
}

/** Whether the assistants may add to the notes here. On unless the people turned it off. */
export const memoryOn = (conversation: Pick<IConversation, 'assistants'>): boolean => conversation.assistants?.memoryOn !== false;

/**
 * Applied to what is stored now, not to what this reply started with: someone
 * may have edited the notes while the assistant was working. If the text moves
 * between the read and the write, the change is tried once more on the new text.
 */
async function change(conversation: IConversation, apply: (memory: string) => Change): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const fresh = await Conversation.findById(conversation._id).select('assistants');
    const before = fresh?.assistants?.memory ?? '';
    const result = apply(before);
    if (!result.changed) return result.message;
    const saved = await Conversation.updateOne(
      { _id: conversation._id, $or: [{ 'assistants.memory': before }, ...(before === '' ? [{ 'assistants.memory': { $exists: false } }] : [])] },
      { $set: { 'assistants.memory': result.memory } }
    );
    if (saved.modifiedCount === 1) {
      if (conversation.assistants) conversation.assistants.memory = result.memory;
      announce(conversation);
      return result.message;
    }
  }
  return 'The notes were being edited. Try again.';
}

/** The two tools, for one conversation. Empty when the people have turned noting off. */
export function memoryTools(conversation: IConversation): ClientTool[] {
  if (!memoryOn(conversation)) return [];
  return [
    {
      name: 'remember',
      description:
        'Add one short note about the people in this chat that will help every assistant here next time: a like, a dietary need, a habit, a date that matters, a place. One fact in plain words, ' +
        `at most ${NOTE_LIMIT} characters. The people in the chat can read and edit the notes.`,
      input_schema: {
        type: 'object',
        properties: { note: { type: 'string', description: 'The fact, e.g. "Mia is vegetarian"' } },
        required: ['note']
      },
      run: (input) => change(conversation, (memory) => addNote(memory, String((input as { note?: unknown }).note ?? '')))
    },
    {
      name: 'forget',
      description: 'Take one note away, when someone asks you to forget it or it is no longer true. Give the note, or enough of its words to be only that one.',
      input_schema: {
        type: 'object',
        properties: { note: { type: 'string', description: 'The note, or part of it' } },
        required: ['note']
      },
      run: (input) => change(conversation, (memory) => removeNote(memory, String((input as { note?: unknown }).note ?? '')))
    }
  ];
}
