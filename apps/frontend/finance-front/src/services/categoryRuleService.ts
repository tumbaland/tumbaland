import { financeApi } from './financeApi';
import { ApiResponse } from '../types';
import { TransactionType } from './cashflowService';

/**
 * How a rule's pattern is read.
 *
 *   text  — a case-insensitive substring of the counterparty, ignoring accents.
 *           Everything written from the UI is one of these.
 *   regex — a full expression. The rules migrated out of the service's source
 *           are these: they carry lookaheads and word boundaries that took a
 *           decade of corrections to get right and no substring can express.
 */
export type MatchType = 'text' | 'regex';

export interface CategoryRule {
  _id: string;
  pattern: string;
  matchType: MatchType;
  category: string;
  /** Restricts the rule to money in or money out; absent means either. */
  type?: TransactionType;
  /** Lower runs first. The first rule that matches decides the category. */
  priority: number;
  /** Why the rule exists — worth reading before editing one you did not write. */
  note?: string;
  groupId?: string;
}

export interface CategoryRuleInput {
  pattern: string;
  matchType?: MatchType;
  category: string;
  type?: TransactionType;
  note?: string;
}

export interface ApplyRulesResult {
  /** Transactions whose category actually changed. */
  updated: number;
  /** Transactions the rules looked at. */
  examined: number;
  categories: Array<{ category: string; count: number }>;
}

const RULES_URL = '/category-rules';

const scoped = (groupId?: string) => (groupId ? { params: { groupId } } : undefined);

export const getCategoryRules = async (groupId?: string): Promise<CategoryRule[]> => {
  const res = await financeApi.get<ApiResponse<CategoryRule[]>>(RULES_URL, scoped(groupId));
  return res.data;
};

export const createCategoryRule = async (
  input: CategoryRuleInput,
  groupId?: string
): Promise<CategoryRule> => {
  const res = await financeApi.post<ApiResponse<CategoryRule>>(RULES_URL, input, scoped(groupId));
  return res.data;
};

export const updateCategoryRule = async (
  id: string,
  input: Omit<Partial<CategoryRuleInput>, 'type'> & { type?: TransactionType | null }
): Promise<CategoryRule> => {
  const res = await financeApi.put<ApiResponse<CategoryRule>>(`${RULES_URL}/${id}`, input);
  return res.data;
};

export const deleteCategoryRule = async (id: string): Promise<void> => {
  await financeApi.delete(`${RULES_URL}/${id}`);
};

/** Order decides the outcome, so it has to be changeable. */
export const moveCategoryRule = async (
  id: string,
  direction: 'up' | 'down',
  groupId?: string
): Promise<CategoryRule[]> => {
  const res = await financeApi.post<ApiResponse<CategoryRule[]>>(
    `${RULES_URL}/${id}/move`,
    { direction },
    scoped(groupId)
  );
  return res.data;
};

/**
 * Run the rules over transactions already imported.
 *
 * Without this a new rule only takes effect on the next statement, leaving the
 * backlog that prompted it exactly where it was.
 */
export const applyCategoryRules = async (
  options: { onlyUncategorised?: boolean; groupId?: string } = {}
): Promise<ApplyRulesResult> => {
  const { groupId, ...body } = options;
  const res = await financeApi.post<ApiResponse<ApplyRulesResult>>(
    `${RULES_URL}/apply`,
    body,
    scoped(groupId)
  );
  return res.data;
};
