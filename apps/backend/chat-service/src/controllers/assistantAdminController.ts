import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import { caller } from '../services/accessService';
import { getKeyStatus, recheckKey, removeKey, saveKey, type SaveKeyInput } from '../services/assistantKeyService';
import { adminUsage } from '../services/assistantUsageService';

export const getKey = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await getKeyStatus());
};

export const putKey = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await saveKey(caller(req), req.body as SaveKeyInput));
};

export const checkKey = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await recheckKey(caller(req)));
};

export const deleteKey = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await removeKey(caller(req)));
};

export const usage = async (req: Request, res: Response): Promise<void> => {
  const month = typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestError('month has to look like 2026-10');
  sendSuccess(res, await adminUsage(month));
};
