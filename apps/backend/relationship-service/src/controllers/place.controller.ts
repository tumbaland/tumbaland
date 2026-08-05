import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import * as PlaceService from '../services/place.service';

/**
 * Get every distinct place in scope with visit counts — the map page's pins,
 * and the day editor's "places you've been" suggestions.
 */
export const getPlaces = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId, typeId, startDate, endDate } = req.query;

  const places = await PlaceService.getPlaces({
    userId: user.id,
    userGroupIds: userGroups,
    groupId: groupId as string | undefined,
    typeId: typeId as string | undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined
  });

  sendSuccess(res, places);
};

/**
 * Get the individual visits behind one pin.
 */
export const getPlaceVisits = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId, lat, lng, limit } = req.query;

  const parsedLat = parseFloat(lat as string);
  const parsedLng = parseFloat(lng as string);
  if (!isFinite(parsedLat) || !isFinite(parsedLng)) {
    throw new BadRequestError('lat and lng are required');
  }

  const visits = await PlaceService.getPlaceVisits({
    userId: user.id,
    userGroupIds: userGroups,
    groupId: groupId as string | undefined,
    lat: parsedLat,
    lng: parsedLng,
    limit: limit ? parseInt(limit as string) || 50 : 50
  });

  sendSuccess(res, visits);
};
