import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import { MAX_PREVIEW_WIDTH, MIN_PREVIEW_WIDTH } from './draw';
import { albumContactSheet, collagePreview } from './preview.service';

/** The default preview width: enough to judge a layout, a few hundred kilobytes at most. */
const DEFAULT_PREVIEW_WIDTH = 1024;
const DEFAULT_SHEET_SIZE = 36;
const MAX_SHEET_SIZE = 48;

const integer = (raw: unknown, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

const WHOLE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date from the query. With `endOfDay`, a bare day (YYYY-MM-DD) means the end
 * of that day, so "taken on or before 2025-07-31" includes the 31st rather than
 * stopping at its first moment.
 */
const day = (raw: unknown, name: string, endOfDay = false): Date | undefined => {
  if (raw === undefined || raw === '') return undefined;
  const date = typeof raw === 'string' ? new Date(raw) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new BadRequestError(`${name} is not a date`);
  if (endOfDay && typeof raw === 'string' && WHOLE_DAY.test(raw)) date.setUTCHours(23, 59, 59, 999);
  return date;
};

/**
 * GET /api/collages/:id/preview?width=1024&outline=1
 *
 * The collage drawn as a JPEG, base64 in the usual envelope. `outline` draws
 * each item's box and short name over it.
 */
export const getCollagePreview = async (req: Request, res: Response): Promise<void> => {
  const preview = await collagePreview(
    req.params.id as string,
    { userId: req.user!.id, userGroups: req.userGroups || [] },
    {
      width: integer(req.query.width, DEFAULT_PREVIEW_WIDTH, MIN_PREVIEW_WIDTH, MAX_PREVIEW_WIDTH),
      outline: req.query.outline === '1' || req.query.outline === 'true'
    }
  );
  sendSuccess(res, preview);
};

/**
 * GET /api/photos/album/:albumId/sheet?page=1&size=36&tag=&from=&to=
 *
 * One page of an album as a numbered grid of pictures, with the list of which
 * number is which photo.
 */
export const getAlbumContactSheet = async (req: Request, res: Response): Promise<void> => {
  const sheet = await albumContactSheet(
    req.params.albumId as string,
    {
      page: integer(req.query.page, 1, 1, 10_000),
      size: integer(req.query.size, DEFAULT_SHEET_SIZE, 1, MAX_SHEET_SIZE),
      tag: typeof req.query.tag === 'string' && req.query.tag ? req.query.tag : undefined,
      from: day(req.query.from, 'from'),
      to: day(req.query.to, 'to', true)
    },
    { userId: req.user!.id, userGroups: req.userGroups || [] }
  );
  sendSuccess(res, sheet);
};
