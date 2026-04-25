import { Request, Response } from 'express';
import { getDashboardData } from '../services/dashboard.service';

/**
 * Get dashboard data
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { groupId } = req.query;

    let groupIds: string[] = [];
    if (groupId) {
      // Get dashboard for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
      groupIds = [groupId as string];
    } else {
      // No groupId specified: show personal dashboard (no group)
      groupIds = [];
    }

    const dashboardData = await getDashboardData(user.id, groupIds);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data'
    });
  }
};