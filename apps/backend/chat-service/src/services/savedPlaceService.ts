import { BadRequestError, NotFoundError } from '@tumbaland/backend-core';
import { Types } from 'mongoose';
import { IConversation } from '../models/Conversation';
import { ISavedPlace, SavedPlace } from '../models/SavedPlace';
import type { Caller } from './accessService';

/** Enough for every place two people go; a list longer than this is no longer a quick pick. */
export const MAX_SAVED_PLACES = 50;

export interface SavedPlaceView {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

const toView = (place: ISavedPlace): SavedPlaceView => ({
  id: place._id.toString(),
  name: place.name,
  lat: place.lat,
  lng: place.lng,
  address: place.address
});

/** The group's places, by name. */
export async function listPlaces(conversation: IConversation): Promise<SavedPlaceView[]> {
  const places = await SavedPlace.find({ groupId: conversation.groupId }).sort({ name: 1 });
  return places.map(toView);
}

export async function savePlace(
  person: Caller,
  conversation: IConversation,
  input: { name: string; lat: number; lng: number; address?: string }
): Promise<SavedPlaceView> {
  const count = await SavedPlace.countDocuments({ groupId: conversation.groupId });
  if (count >= MAX_SAVED_PLACES) throw new BadRequestError(`You can keep ${MAX_SAVED_PLACES} places. Delete one first.`);
  const place = await SavedPlace.create({
    groupId: conversation.groupId,
    name: input.name.trim(),
    lat: input.lat,
    lng: input.lng,
    address: input.address?.trim() ?? '',
    createdBy: person.id
  });
  return toView(place);
}

/** Anyone in the group may: the places are the group's. */
export async function deletePlace(conversation: IConversation, placeId: string): Promise<void> {
  if (!Types.ObjectId.isValid(placeId)) throw new NotFoundError('That place is not saved');
  const removed = await SavedPlace.findOneAndDelete({ _id: placeId, groupId: conversation.groupId });
  if (!removed) throw new NotFoundError('That place is not saved');
}
