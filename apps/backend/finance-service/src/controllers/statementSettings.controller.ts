import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import * as statementSettingsService from '../services/statementSettings.service';
import { contextGroupId, contextGroups } from '../utils/scope';

export const getStatementSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const settings = await statementSettingsService.getSettings(user.id, contextGroups(req));

  sendSuccess(res, settings);
};

/** Records how the account holder's name appears on their statements. */
export const updateStatementSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const settings = await statementSettingsService.saveSettings(
    { ...req.body, groupId: contextGroupId(req) },
    user.id,
    userGroups
  );

  sendSuccess(res, { ownerNames: settings.ownerNames }, 'Settings saved');
};
