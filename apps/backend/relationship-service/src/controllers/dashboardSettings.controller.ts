import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import * as DashboardSettingsService from '../services/dashboardSettings.service';

/**
 * Get dashboard settings for the current scope (personal or group)
 */
export const getDashboardSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  const settings = await DashboardSettingsService.getDashboardSettings(
    user.id,
    userGroups,
    groupId as string | undefined
  );

  sendSuccess(res, settings);
};

/**
 * Save dashboard settings for the current scope (personal or group)
 */
export const saveDashboardSettings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { highlightTypeIds, hiddenTypeIds, startDate, groupId } = req.body;

  const settings = await DashboardSettingsService.saveDashboardSettings(
    { highlightTypeIds, hiddenTypeIds, startDate },
    user.id,
    userGroups,
    groupId
  );

  sendSuccess(res, settings, 'Dashboard settings saved');
};
