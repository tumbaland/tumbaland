import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess } from '@tumbaland/core';
import { getDashboardData } from '../services/dashboard.service';

/**
 * Get dashboard data
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  // No groupId specified: show personal dashboard (no group)
  if (groupId && !userGroups.includes(groupId as string)) {
    throw new ForbiddenError('Access denied');
  }

  const dashboardData = await getDashboardData(user.id, groupId as string | undefined);

  sendSuccess(res, dashboardData);
};
