import CategoryRule, { ICategoryRule, MatchType } from '../models/CategoryRule';
import Transaction, { TransactionType } from '../models/Transaction';
import { BadRequestError, ForbiddenError, NotFoundError, canAccessResource } from '@tumbaland/backend-core';
import { tenantScope } from '../utils/scope';
import { hasNestedRepetition } from '../utils/nestedRepetition';
import {
  CompiledRule,
  compileRules,
  matchCustomRule,
  fold,
  FALLBACK_CATEGORIES
} from './bankStatement.service';

export interface CategoryRuleInput {
  pattern: string;
  /** Defaults to a plain substring test, which is what the UI writes. */
  matchType?: MatchType;
  category: string;
  type?: TransactionType;
  note?: string;
  groupId?: string;
}

/**
 * Refuse a regex rule where its owner is looking at the field they typed it
 * into. One that will not compile would be skipped silently at import time and
 * appear to do nothing. One that repeats a repeating group can backtrack for
 * minutes on a single row, and every import runs every rule on every row.
 */
function assertUsableRegex(pattern: string, { checkRepetition }: { checkRepetition: boolean }): void {
  try {
    new RegExp(pattern);
  } catch {
    throw new BadRequestError(`${pattern} is not a valid regular expression`);
  }
  if (checkRepetition && hasNestedRepetition(pattern)) {
    throw new BadRequestError(
      `${pattern} repeats a group that itself repeats, which can take minutes to run on one row. ` +
        'Write the inner part without + or *, or split it into separate rules.'
    );
  }
}

/**
 * Rules run in a fixed order, and the order is the owner's to set: a rule for
 * "BOLT FOOD" has to be reachable ahead of one for "BOLT". New rules go on the
 * end, where they cannot silently shadow anything already working.
 */
const nextPriority = async (scope: Record<string, unknown>): Promise<number> => {
  const last = await CategoryRule.findOne(scope).sort({ priority: -1 }).select({ priority: 1 }).lean();
  return last ? (last.priority ?? 0) + 1 : 0;
};

const assertGroupAccess = (groupId: string | undefined, userGroups: string[]): void => {
  if (groupId && !userGroups.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }
};

export const listRules = async (
  userId: string,
  userGroups: string[] = []
): Promise<ICategoryRule[]> =>
  CategoryRule.find(tenantScope(userId, userGroups)).sort({ priority: 1, createdAt: 1 });

/** The owner's rules, ready to classify with. */
export const getCompiledRules = async (
  userId: string,
  userGroups: string[] = []
): Promise<CompiledRule[]> => compileRules(await listRules(userId, userGroups));

const findAccessible = async (
  id: string,
  userId: string,
  userGroups: string[]
): Promise<ICategoryRule> => {
  const existing = await CategoryRule.findById(id);
  if (!existing) {
    throw new NotFoundError('Category rule not found');
  }
  if (!canAccessResource(userId, existing.userId, existing.groupId, userGroups, false)) {
    throw new ForbiddenError('Access denied');
  }
  return existing;
};

/**
 * Write a rule, replacing any the owner already has for the same text.
 *
 * Upsert rather than reject: correcting the same merchant twice is the normal
 * way this gets used — the first guess at a category was wrong, or the merchant
 * changed what it sells — and an error telling the user a rule already exists
 * would leave them to go and find it. Comparison is on the folded, lowercased
 * pattern, so "Rimi" does not become a second rule beside "RIMI".
 */
export const saveRule = async (
  input: CategoryRuleInput,
  userId: string,
  userGroups: string[] = []
): Promise<{ rule: ICategoryRule; replaced: boolean }> => {
  assertGroupAccess(input.groupId, userGroups);

  const pattern = input.pattern.trim();
  const needle = fold(pattern).toLowerCase();
  if (!needle) {
    throw new BadRequestError('pattern cannot be blank');
  }

  const matchType: MatchType = input.matchType || 'text';
  if (matchType === 'regex') assertUsableRegex(pattern, { checkRepetition: true });

  const scope = tenantScope(userId, input.groupId ? [input.groupId] : []);
  const existing = (await CategoryRule.find(scope)).find(
    (rule) =>
      fold(rule.pattern).trim().toLowerCase() === needle &&
      rule.type === input.type &&
      (rule.matchType || 'text') === matchType
  );

  if (existing) {
    existing.category = input.category.trim();
    if (input.note !== undefined) existing.note = input.note;
    return { rule: await existing.save(), replaced: true };
  }

  const rule = await new CategoryRule({
    pattern,
    matchType,
    category: input.category.trim(),
    ...(input.type ? { type: input.type } : {}),
    ...(input.note ? { note: input.note } : {}),
    priority: await nextPriority(scope),
    userId,
    ...(input.groupId ? { groupId: input.groupId } : {})
  }).save();

  return { rule, replaced: false };
};

export interface CategoryRuleUpdate {
  pattern?: string;
  category?: string;
  /** Explicit null clears the direction restriction; omitted leaves it alone. */
  type?: TransactionType | null;
  note?: string;
}

export const updateRule = async (
  id: string,
  data: CategoryRuleUpdate,
  userId: string,
  userGroups: string[] = []
): Promise<ICategoryRule> => {
  const existing = await findAccessible(id, userId, userGroups);

  if (data.pattern !== undefined) {
    const pattern = data.pattern.trim();
    if (!fold(pattern).toLowerCase()) {
      throw new BadRequestError('pattern cannot be blank');
    }
    existing.pattern = pattern;
  }
  if (data.category !== undefined) existing.category = data.category.trim();
  if (data.note !== undefined) existing.note = data.note;
  // Undefined leaves the restriction alone, so renaming a rule cannot silently
  // widen it to both directions.
  if (data.type !== undefined) existing.type = data.type ?? undefined;

  // A rename can turn a working regex into one that will not compile, and a
  // rule that silently stops matching is worse than a refused edit. The
  // repetition check only applies to a new pattern: a rule saved before it
  // existed can still have its category changed.
  if ((existing.matchType || 'text') === 'regex') {
    assertUsableRegex(existing.pattern, { checkRepetition: data.pattern !== undefined });
  }

  return existing.save();
};

export const deleteRule = async (
  id: string,
  userId: string,
  userGroups: string[] = []
): Promise<void> => {
  await findAccessible(id, userId, userGroups);
  await CategoryRule.findByIdAndDelete(id);
};

/**
 * Move a rule one place earlier or later in the running order.
 *
 * The whole list is renumbered from its new order rather than swapping the two
 * priorities involved. Swapping is fewer writes, but it silently does nothing
 * when the pair happens to share a priority — which rules created before
 * ordering existed, or restored from a backup, readily do. Renumbering cannot
 * land in that state; the lists are tens of rows, so the cost is not real.
 */
export const moveRule = async (
  id: string,
  direction: 'up' | 'down',
  userId: string,
  userGroups: string[] = []
): Promise<ICategoryRule[]> => {
  const rule = await findAccessible(id, userId, userGroups);
  const ordered = await listRules(userId, userGroups);

  const at = ordered.findIndex((r) => String(r._id) === String(rule._id));
  const to = direction === 'up' ? at - 1 : at + 1;
  // Already at the end it is being asked to move towards; nothing to do.
  if (at === -1 || to < 0 || to >= ordered.length) return ordered;

  const reordered = [...ordered];
  [reordered[at], reordered[to]] = [reordered[to], reordered[at]];

  await Promise.all(
    reordered
      .map((r, index) => ({ r, index }))
      .filter(({ r, index }) => r.priority !== index)
      .map(({ r, index }) => {
        r.priority = index;
        return r.save();
      })
  );

  return listRules(userId, userGroups);
};

export interface ApplyResult {
  /** Rows whose category actually changed. */
  updated: number;
  /** Rows the rules looked at. */
  examined: number;
  categories: Array<{ category: string; count: number }>;
}

export interface ApplyOptions {
  groupId?: string;
  /**
   * Restrict to rows nothing has claimed yet. On by default: a rule written
   * today should not quietly undo a category the owner set by hand last year.
   */
  onlyUncategorised?: boolean;
}

/**
 * Run the owner's rules over transactions already imported.
 *
 * Without this a new rule only takes effect on the next statement, leaving the
 * backlog it was written to clear exactly where it was. Matching is against the
 * stored note, which is the counterparty and description the rules were written
 * for.
 */
export const applyRulesToExisting = async (
  userId: string,
  userGroups: string[] = [],
  options: ApplyOptions = {}
): Promise<ApplyResult> => {
  assertGroupAccess(options.groupId, userGroups);

  const rules = await getCompiledRules(userId, userGroups);
  if (rules.length === 0) {
    return { updated: 0, examined: 0, categories: [] };
  }

  const onlyUncategorised = options.onlyUncategorised !== false;
  const filter: Record<string, unknown> = {
    ...tenantScope(userId, userGroups),
    ...(onlyUncategorised ? { category: { $in: [...FALLBACK_CATEGORIES] } } : {})
  };

  const candidates = await Transaction.find(filter, { note: 1, category: 1, type: 1 }).lean();

  const changes: Array<{ id: string; category: string }> = [];
  for (const transaction of candidates) {
    const match = matchCustomRule(rules, fold(transaction.note || ''), transaction.type);
    if (!match || match.category === transaction.category) continue;
    changes.push({ id: String(transaction._id), category: match.category });
  }

  if (changes.length > 0) {
    await Transaction.bulkWrite(
      changes.map((change) => ({
        updateOne: { filter: { _id: change.id }, update: { $set: { category: change.category } } }
      })),
      { ordered: false }
    );
  }

  const byCategory = new Map<string, number>();
  for (const change of changes) {
    byCategory.set(change.category, (byCategory.get(change.category) || 0) + 1);
  }

  return {
    updated: changes.length,
    examined: candidates.length,
    categories: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  };
};
