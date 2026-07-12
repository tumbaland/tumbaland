import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import statisticsService from '../services/statisticsService';

/**
 * Get album statistics for dashboard
 */
export const getAlbumStatistics = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  const statistics = await statisticsService.getAlbumStatistics(
    { groupId: groupId as string },
    { userId: user.id, userGroups }
  );

  sendSuccess(res, statistics);
};
