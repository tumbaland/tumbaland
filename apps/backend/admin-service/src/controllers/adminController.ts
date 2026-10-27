import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { getAssistants } from '../services/assistantsService';
import { getDeletions } from '../services/deletionsService';
import { getOverview } from '../services/overviewService';
import { getUserDetail } from '../services/userDetailService';
import { listUsers, USER_SORTS, type UserSort } from '../services/usersService';

/**
 * A positive whole number from the query string, within bounds; the fallback
 * when it is missing or not one. A bad `?days=` is a typo to be ignored, not a
 * reason to fail a dashboard.
 */
const count = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
};

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

export const overview = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await getOverview({ days: count(req.query.days, 30, 365) }));
};

export const users = async (req: Request, res: Response): Promise<void> => {
  const sort = USER_SORTS.find((candidate) => candidate === req.query.sort) as UserSort | undefined;
  sendSuccess(
    res,
    await listUsers({
      sort,
      order: req.query.order === 'asc' ? 'asc' : req.query.order === 'desc' ? 'desc' : undefined,
      page: count(req.query.page, 1, 100_000),
      limit: count(req.query.limit, 25, 100),
      q: text(req.query.q)
    })
  );
};

export const user = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await getUserDetail(String(req.params.id)));
};

export const assistants = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await getAssistants({ days: count(req.query.days, 30, 365) }));
};

export const deletions = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await getDeletions());
};
