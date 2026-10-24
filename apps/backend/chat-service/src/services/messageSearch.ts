import { escapeRegex } from '@tumbaland/backend-core';
import { Message } from '../models/Message';
import { MessageView, toView } from './messageView';
import { MAX_MESSAGE_PAGE_SIZE } from './messageService';

/** The longest term searched for; anything past it is dropped. */
const MAX_SEARCH_TERM = 100;

/**
 * The term as a pattern: taken literally, except that е and ё match each
 * other. Russian is mostly typed without ё ("еще" for "ещё"), so a search
 * would otherwise miss half of what was written. Case is left to the `i`
 * flag, which folds Cyrillic as well as Latin.
 */
const searchPattern = (term: string) => escapeRegex(term).replace(/[еёЕЁ]/g, '[еёЕЁ]');

/**
 * Messages in the conversations the caller can reach whose text contains the
 * term, newest first.
 *
 * A plain substring match, in any case, rather than the text index. The index
 * matches whole English words only, so "rest" missed "restaurant" and Estonian
 * words were cut by English stemming rules; people searching a chat type the
 * start of a word and expect the latest mention first. Scoped by
 * conversation, it walks that conversation's own index, which a couple's
 * history stays well inside.
 *
 * Works the same for Russian: any case, and е finds ё (see searchPattern).
 *
 * Notes about the conversation ("Irja set photos to go to Rome") and unsent
 * messages are left out.
 */
export async function searchMessages(
  conversationIds: string[],
  term: string,
  limit = 50
): Promise<MessageView[]> {
  const needle = term.trim().slice(0, MAX_SEARCH_TERM);
  if (conversationIds.length === 0 || !needle) return [];

  const rows = await Message.find({
    conversationId: { $in: conversationIds },
    deletedAt: null,
    kind: { $ne: 'system' },
    body: { $regex: searchPattern(needle), $options: 'i' }
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(limit, MAX_MESSAGE_PAGE_SIZE));
  // Not signed: the search list shows the text it matched and opens the thread,
  // which signs its own page. Signing here cost a file-service call per search.
  return rows.map(toView);
}
