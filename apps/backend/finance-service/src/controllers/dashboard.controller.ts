import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { getDashboardData } from '../services/dashboard.service';
import { contextGroupId } from '../utils/scope';

/**
 * Get dashboard data
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  // No groupId specified: show personal dashboard (no group)
  const dashboardData = await getDashboardData(user.id, contextGroupId(req));

  sendSuccess(res, dashboardData);
};
