import type { MapPoint } from '../components/live/LiveMap';
import type { ConversationMember, LiveShare } from '../types';
import { DESTINATION_COLOR, PERSON_COLOR, STALE_MS, ageText, distanceBetween } from './live';

/** The colour of everyone who is not the one holding the phone. */
export const OTHER_COLOR = '#1e88e5';

/** A position as the map takes it. */
type Where = { lat: number; lng: number; accuracy?: number | null; at?: number };

export interface LivePointsOptions {
  members: ConversationMember[];
  currentUserId: string;
  now: number;
  /**
   * Where this phone says it is: fresher than the server's copy, and there
   * before the server has answered the first position.
   */
  ownPosition?: Where | null;
  /** What a pin is called, by who shared it, where the share itself does not say. */
  labels?: Record<string, string>;
  /** Leaves the caller's own share and position out, for a map that draws them itself. */
  othersOnly?: boolean;
}

const colorFor = (own: boolean) => (own ? PERSON_COLOR : OTHER_COLOR);

/** A share that has run out is gone from the map even if the server has not swept it yet. */
const running = (share: LiveShare, now: number) => new Date(share.endsAt).getTime() > now;

/** A live position not heard from for a while. A pin stays put on purpose, so it is never old. */
export const isStale = (share: LiveShare, now: number, at: string | number | undefined = share.position?.at): boolean =>
  !share.fixed && at !== undefined && now - new Date(at).getTime() > STALE_MS;

/** The first letter of a name, for someone with no photo. */
const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/**
 * Everyone sharing in the conversation, and where each is heading, as points
 * for the map. A person is their photo, whether live or a pin they sent: a pin
 * is where they are, and their face is how it is told apart from a destination.
 * Only destinations are pins. The caller's own point keeps the ids `me` and
 * `destination`.
 */
export function buildLivePoints(shares: LiveShare[], options: LivePointsOptions): MapPoint[] {
  const { members, currentUserId, now, ownPosition, labels = {}, othersOnly = false } = options;
  const points: MapPoint[] = [];
  let sawOwn = false;

  for (const share of shares) {
    const own = share.userId === currentUserId;
    if (!running(share, now) || (othersOnly && own)) continue;
    sawOwn ||= own;
    const color = colorFor(own);
    const member = members.find((entry) => entry.userId === share.userId);
    const name = share.name || member?.name || 'Someone';
    const position = own && ownPosition ? ownPosition : share.position;

    if (position) {
      const at = own && ownPosition?.at ? ownPosition.at : share.position?.at;
      const stale = isStale(share, now, at);
      const who = own ? 'You' : name;
      // Whose pin it is matters once both are on the map: "Irja: The store".
      const pinName = share.fixed ? labels[share.userId] || share.pinLabel : null;
      const label = pinName ? `${who}: ${pinName}` : who;
      points.push({
        id: own ? 'me' : share.userId,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        color,
        // A faded face says it is old; this says how old.
        label: stale && at !== undefined ? `${label} · ${ageText(at, now)}` : label,
        kind: 'person',
        picture: member?.picture ?? null,
        initial: initialOf(name),
        stale
      });
    }
    if (share.destination) {
      points.push({
        id: own ? 'destination' : `destination:${share.userId}`,
        lat: share.destination.lat,
        lng: share.destination.lng,
        color: own ? DESTINATION_COLOR : color,
        label: share.destination.label || 'Destination',
        kind: 'place'
      });
    }
  }

  // This phone knows where it is before the server has said so.
  if (!sawOwn && ownPosition && !othersOnly) {
    const member = members.find((entry) => entry.userId === currentUserId);
    points.unshift({
      id: 'me',
      lat: ownPosition.lat,
      lng: ownPosition.lng,
      accuracy: ownPosition.accuracy,
      color: PERSON_COLOR,
      label: 'You',
      kind: 'person',
      picture: member?.picture ?? null,
      initial: initialOf(member?.name || 'You'),
      stale: false
    });
  }
  return points;
}

/**
 * How far apart two people are, when both are somewhere recent: a stale
 * position would say a distance that is no longer true.
 */
export function apartBetween(
  mine: { lat: number; lng: number } | null | undefined,
  other: LiveShare,
  now: number
): number | null {
  if (!mine || !other.position || !running(other, now) || isStale(other, now)) return null;
  return distanceBetween(mine, other.position);
}
