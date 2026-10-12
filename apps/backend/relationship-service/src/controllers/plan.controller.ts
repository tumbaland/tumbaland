import { Request, Response } from 'express';
import { sendSuccess, countRead } from '@tumbaland/backend-core';
import * as PlanService from '../services/plan.service';
import { dayToDate } from '../services/day.service';

/**
 * Plans in a range of days (`startDate`/`endDate`, YYYY-MM-DD), or the ones
 * not yet logged from a day on (`upcoming=true&startDate=<today>`).
 */
export const getPlans = async (req: Request, res: Response): Promise<void> => {
  const { groupId, startDate, endDate, upcoming, limit } = req.query;

  const plans = await PlanService.listPlans({
    userId: req.user!.id,
    userGroupIds: req.userGroups || [],
    groupId: groupId as string | undefined,
    startDate: startDate ? dayToDate(startDate as string) : undefined,
    endDate: endDate ? dayToDate(endDate as string) : undefined,
    upcoming: upcoming === 'true',
    limit: limit ? parseInt(limit as string) || 100 : 100
  });

  countRead(res, plans.length);
  sendSuccess(res, plans);
};

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  const plan = await PlanService.createPlan(req.body, req.user!.id, req.userGroups || []);
  sendSuccess(res, plan, 'Plan saved', 201);
};

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  const plan = await PlanService.updatePlan(req.params.id as string, req.body, req.user!.id, req.userGroups || []);
  sendSuccess(res, plan, 'Plan saved');
};

export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  await PlanService.deletePlan(req.params.id as string, req.user!.id, req.userGroups || []);
  sendSuccess(res, undefined, 'Plan deleted');
};

export const logPlan = async (req: Request, res: Response): Promise<void> => {
  const result = await PlanService.logPlan(
    req.params.id as string,
    req.body?.typeId,
    req.user!.id,
    req.userGroups || []
  );
  sendSuccess(res, result, 'Plan logged');
};
