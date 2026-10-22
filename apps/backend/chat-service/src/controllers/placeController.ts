import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import type { ZodType } from 'zod';
import { placeReverseSchema, placeSearchSchema } from '../validation/schemas';
import { caller, requireConversation } from '../services/accessService';
import * as geocoding from '../services/geocodingService';
import * as places from '../services/savedPlaceService';

/** The query string, checked as `validate` checks a body. */
function query<T>(req: Request, schema: ZodType<T>): T {
  const result = schema.safeParse(req.query);
  if (!result.success) throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid query');
  return result.data;
}

/** GET /api/chat/places/search?q=&lat=&lng= */
export const search = async (req: Request, res: Response): Promise<void> => {
  const { q, lat, lng } = query(req, placeSearchSchema);
  const near = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  sendSuccess(res, await geocoding.searchPlaces(q, near));
};

/** GET /api/chat/places/reverse?lat=&lng= : the address at a point, or null. */
export const reverse = async (req: Request, res: Response): Promise<void> => {
  const { lat, lng } = query(req, placeReverseSchema);
  sendSuccess(res, await geocoding.placeAt(lat, lng));
};

/** GET /api/chat/conversations/:id/places */
export const list = async (req: Request, res: Response): Promise<void> => {
  const conversation = await requireConversation(caller(req), req.params.id as string);
  sendSuccess(res, await places.listPlaces(conversation));
};

/** POST /api/chat/conversations/:id/places */
export const save = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await places.savePlace(person, conversation, req.body), undefined, 201);
};

/** DELETE /api/chat/conversations/:id/places/:placeId */
export const remove = async (req: Request, res: Response): Promise<void> => {
  const conversation = await requireConversation(caller(req), req.params.id as string);
  await places.deletePlace(conversation, req.params.placeId as string);
  res.status(204).send();
};
