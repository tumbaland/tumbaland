import { Request, Response } from 'express';
import { ForbiddenError } from '@tumbaland/core';
import { getDashboardData } from '../services/dashboard.service';

/**
 * Get dashboard data
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  // No groupId specified: show personal dashboard (no group)
  let groupIds: string[] = [];
  if (groupId) {
    // Get dashboard for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
    groupIds = [groupId as string];
  }

  const dashboardData = await getDashboardData(user.id, groupIds);

  res.json({
    success: true,
    data: dashboardData
  });
};
