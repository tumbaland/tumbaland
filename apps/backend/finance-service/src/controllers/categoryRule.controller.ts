import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import * as categoryRuleService from '../services/categoryRule.service';
import { contextGroupId, contextGroups } from '../utils/scope';

/** The owner's categorisation rules, in the order they run. */
export const getCategoryRules = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const rules = await categoryRuleService.listRules(user.id, contextGroups(req));

  sendSuccess(res, rules);
};

/**
 * Teach the app a categorisation.
 *
 * Writing a rule for text that already has one replaces it rather than failing:
 * the second correction is the one the owner means.
 */
export const createCategoryRule = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { rule, replaced } = await categoryRuleService.saveRule(
    { ...req.body, groupId: contextGroupId(req) },
    user.id,
    userGroups
  );

  sendSuccess(
    res,
    rule,
    replaced ? `Rule for ${rule.pattern} updated` : `${rule.pattern} will be filed as ${rule.category}`,
    replaced ? 200 : 201
  );
};

export const updateCategoryRule = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const rule = await categoryRuleService.updateRule(id as string, req.body, user.id, userGroups);

  sendSuccess(res, rule, 'Rule updated');
};

export const deleteCategoryRule = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await categoryRuleService.deleteRule(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Rule deleted');
};

/** Reorder: the first rule that matches wins, so position decides the outcome. */
export const moveCategoryRule = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;
  const { direction } = req.body;

  const rules = await categoryRuleService.moveRule(
    id as string,
    direction,
    user.id,
    contextGroups(req)
  );

  sendSuccess(res, rules, 'Rule moved');
};

/**
 * Run the rules over transactions already imported.
 *
 * Without this a new rule only bites on the next statement, leaving the backlog
 * that prompted it untouched.
 */
export const applyCategoryRules = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const groupId = contextGroupId(req);

  const result = await categoryRuleService.applyRulesToExisting(user.id, contextGroups(req), {
    groupId,
    onlyUncategorised: req.body?.onlyUncategorised
  });

  sendSuccess(
    res,
    result,
    result.updated > 0
      ? `Recategorised ${result.updated} transaction${result.updated === 1 ? '' : 's'}`
      : 'Nothing left for these rules to change'
  );
};
