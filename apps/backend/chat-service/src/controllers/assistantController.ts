import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { caller, requireConversation } from '../services/accessService';
import { allowanceFor, setCap } from '../services/assistantUsageService';
import {
  assistantsView,
  changeSettings,
  createBot,
  deleteBot,
  updateBot,
  type BotChange,
  type BotInput,
  type SettingsChange
} from '../services/botService';

/**
 * Each change answers with the whole view for this viewer, from the conversation
 * already loaded for the change: the services update it in place.
 */
async function load(req: Request) {
  const person = caller(req);
  return { person, conversation: await requireConversation(person, req.params.id as string) };
}

export const getAssistants = async (req: Request, res: Response): Promise<void> => {
  const { person, conversation } = await load(req);
  sendSuccess(res, await assistantsView(person, conversation));
};

export const patchAssistants = async (req: Request, res: Response): Promise<void> => {
  const { person, conversation } = await load(req);
  await changeSettings(person, conversation, req.body as SettingsChange);
  sendSuccess(res, await assistantsView(person, conversation));
};

export const addBot = async (req: Request, res: Response): Promise<void> => {
  const { person, conversation } = await load(req);
  await createBot(person, conversation, req.body as BotInput);
  sendSuccess(res, await assistantsView(person, conversation), undefined, 201);
};

export const patchBot = async (req: Request, res: Response): Promise<void> => {
  const { person, conversation } = await load(req);
  await updateBot(person, conversation, req.params.botId as string, req.body as BotChange);
  sendSuccess(res, await assistantsView(person, conversation));
};

export const removeBot = async (req: Request, res: Response): Promise<void> => {
  const { person, conversation } = await load(req);
  await deleteBot(person, conversation, req.params.botId as string);
  sendSuccess(res, await assistantsView(person, conversation));
};

/** The caller's own allowance, outside any conversation: for the Account page. */
export const myAllowance = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await allowanceFor(caller(req)));
};

export const setMyCap = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  await setCap(person.id, (req.body as { capPercent: number | null }).capPercent);
  sendSuccess(res, await allowanceFor(person));
};
