import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess } from '@tumbaland/backend-core';
import * as statementSettingsService from '../services/statementSettings.service';

function contextGroups(req: Request): string[] {
  const { groupId } = req.query;
  if (!groupId) return [];

  const userGroups = req.userGroups || [];
  if (!userGroups.includes(groupId as string)) {
    throw new ForbiddenError('Access denied');
  }
  return [groupId as string];
}

export const getStatementSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const settings = await statementSettingsService.getSettings(user.id, contextGroups(req));

  sendSuccess(res, settings);
};

/** Records how the account holder's name appears on their statements. */
export const updateStatementSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;
  const groups = contextGroups(req);

  const settings = await statementSettingsService.saveSettings(
    { ...req.body, groupId: groups.length > 0 ? (groupId as string) : undefined },
    user.id,
    userGroups
  );

  sendSuccess(res, { ownerNames: settings.ownerNames }, 'Settings saved');
};
