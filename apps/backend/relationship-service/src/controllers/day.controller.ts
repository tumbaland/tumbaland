import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/core';
import * as DayService from '../services/day.service';

/**
 * Get days with their entries, newest first, paginated by day
 */
export const getDays = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId, page, limit, typeId, search, startDate, endDate } = req.query;

  const result = await DayService.getDays({
    userId: user.id,
    userGroupIds: userGroups,
    groupId: groupId as string | undefined,
    page: page ? parseInt(page as string) || 1 : 1,
    limit: limit ? parseInt(limit as string) || 30 : 30,
    typeId: typeId as string | undefined,
    search: search as string | undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined
  });

  sendSuccess(res, result);
};

/**
 * Create or replace a day's entries (the day editor's save).
 * An empty entries array clears the day.
 */
export const saveDay = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { date } = req.params;
  const { entries, groupId } = req.body;

  const day = await DayService.saveDay(date as string, entries, user.id, userGroups, groupId);

  sendSuccess(res, day, 'Day saved successfully');
};
