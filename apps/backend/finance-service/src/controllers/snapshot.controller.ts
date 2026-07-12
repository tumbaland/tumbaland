import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError, sendSuccess } from '@tumbaland/backend-core';
import * as snapshotService from '../services/snapshot.service';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function resolveGroupId(req: Request): string | undefined {
  const groupId = (req.query.groupId || req.body?.groupId) as string | undefined;
  if (!groupId) return undefined;

  const userGroups = req.userGroups || [];
  if (!userGroups.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }
  return groupId;
}

export const getSnapshots = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const groupId = resolveGroupId(req);

  const snapshots = await snapshotService.getSnapshots(user.id, groupId);

  sendSuccess(res, snapshots);
};

export const upsertSnapshot = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const groupId = resolveGroupId(req);
  const { month } = req.params;

  if (!MONTH_PATTERN.test(month as string)) {
    throw new BadRequestError('Month must be formatted as YYYY-MM');
  }

  const snapshot = await snapshotService.upsertSnapshot(month as string, req.body.entries, user.id, groupId);

  sendSuccess(res, snapshot, 'Snapshot saved successfully');
};

export const deleteSnapshot = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await snapshotService.deleteSnapshot(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Snapshot deleted successfully');
};
