import type { ClientTool } from './assistantClaude';
import type { Caller } from './accessService';
import type { IConversation } from '../models/Conversation';
import { MAX_SAVED_PLACES, listPlaces, savePlace } from './savedPlaceService';
import { placeAt, searchPlaces as geocode } from './geocodingService';
import { distanceText, listShares, type LiveShareView } from './liveLocationService';
import { searchMessages } from './messageSearch';

/**
 * What the people in this chat have already said and saved, for the assistant
 * to look up.
 *
 * Only this conversation, never another one the person happens to be in: the
 * reply is read by everyone here, so it may draw on what everyone here could
 * already read, and nothing else.
 */

const SHOWN = 8;
const CLIP = 300;
const SEARCHED_FOR_MAX = 100;

const clip = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > CLIP ? `${flat.slice(0, CLIP)}...` : flat;
};

/** `2026-10-12 18:02`, on the wall clock of the zone. */
const when = (at: Date, timeZone: string): string =>
  at.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone });

/** How long ago, in a few words. */
const ago = (at: Date, now: Date): string => {
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
};

async function describeShare(share: LiveShareView, now: Date): Promise<string> {
  if (share.fixed) return `${share.name} pinned ${share.pinLabel ?? 'a place'} on the map.`;
  if (!share.position) return `${share.name} is sharing their location but it has not arrived yet.`;
  const { position, destination } = share;
  const near = await placeAt(position.lat, position.lng).catch(() => null);
  const moving = position.speed !== null && position.speed > 1;
  return [
    `${share.name} was ${near ? `near ${near.name}` : 'at a spot on the map'} ${ago(position.at, now)}`,
    destination ? `, heading to ${destination.label ?? 'a marked place'}${destination.distanceM !== null ? `, ${distanceText(destination.distanceM)} away in a straight line` : ''}` : '',
    moving && destination?.distanceM ? `, moving at ${Math.round(position.speed! * 3.6)} km/h (so no sooner than ${Math.max(1, Math.round(destination.distanceM / position.speed! / 60))} min)` : '',
    '.'
  ].join('');
}

/** `askedId` is the message being answered, which is left out of a search: it is the question, not an answer to it. */
export function chatTools(conversation: IConversation, person: Caller, timeZone: string, askedId?: string): ClientTool[] {
  return [
    {
      name: 'search_chat',
      description:
        'Search the earlier messages in this chat for a word or the start of one: "flight", "restaurant", a name. ' +
        `Returns the ${SHOWN} newest matches with who wrote them and when. For when someone said something, or what was ` +
        'decided or sent earlier, beyond the recent messages you were already given. One word works best, not a sentence.',
      input_schema: {
        type: 'object',
        properties: { term: { type: 'string', description: 'A word or part of a word, in the language it was written in' } },
        required: ['term']
      },
      run: async (input) => {
        const term = String((input as { term?: unknown }).term ?? '').trim().slice(0, SEARCHED_FOR_MAX);
        if (term.length < 2) return 'Give a word of at least two letters to search for.';
        const found = (await searchMessages([conversation._id.toString()], term, SHOWN + 1)).filter((message) => !askedId || message.id !== askedId).slice(0, SHOWN);
        if (found.length === 0) return `Nothing in this chat mentions "${term}".`;
        return [
          `${found.length === SHOWN ? `The ${SHOWN} newest messages` : `${found.length} message${found.length === 1 ? '' : 's'}`} mentioning "${term}", newest first (${timeZone} time):`,
          ...found.map((message) => `${when(message.createdAt, timeZone)} ${message.botId ? `${message.senderName} (assistant)` : message.senderName || 'Someone'}: ${clip(message.body)}`)
        ].join('\n');
      }
    },
    {
      name: 'where_is',
      description:
        'Where the people in this chat are right now, for those who are sharing their live location here: roughly where, how long ago, ' +
        'and how far from where they are heading. Only people who chose to share in this chat appear. Nobody sharing means nobody can be located: say so, and do not guess.',
      input_schema: { type: 'object', properties: {} },
      run: async () => {
        const shares = await listShares(conversation);
        if (shares.length === 0) return 'Nobody is sharing their location in this chat right now.';
        const now = new Date();
        return (await Promise.all(shares.map((share) => describeShare(share, now)))).join('\n');
      }
    },
    {
      name: 'saved_places',
      description:
        `The places this group has saved (home, the cottage, the usual sushi place), or save a new one. With no action, lists them with their addresses. ` +
        `With action "save", give a name and where it is: the place is looked up on the map and saved for everyone in the chat (at most ${MAX_SAVED_PLACES}). ` +
        'To delete one, people use the places list in the chat.',
      input_schema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'save'], description: 'list by default' },
          name: { type: 'string', description: 'For save: what the group calls it, e.g. "The cottage"' },
          where: { type: 'string', description: 'For save: an address or place name to look up, e.g. "Viru väljak 4, Tallinn"' }
        }
      },
      run: async (raw) => {
        const input = raw as { action?: string; name?: string; where?: string };
        if (input.action !== 'save') {
          const places = await listPlaces(conversation);
          if (places.length === 0) return 'No places have been saved in this chat yet.';
          return ['Places this group has saved:', ...places.map((place) => `${place.name}${place.address ? `, ${place.address}` : ''} (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`)].join('\n');
        }
        const name = input.name?.trim().slice(0, 60);
        if (!name || !input.where?.trim()) return 'To save a place, give both a name and where it is.';
        const [found] = await geocode(input.where);
        if (!found) return `Could not find "${input.where}" on the map. Ask for a street address.`;
        if ((await listPlaces(conversation)).some((place) => place.name.toLowerCase() === name.toLowerCase())) return `A place called "${name}" is already saved.`;
        const saved = await savePlace(person, conversation, { name, lat: found.lat, lng: found.lng, address: [found.name, found.detail].filter(Boolean).join(', ').slice(0, 200) });
        return `Saved "${saved.name}": ${saved.address || `${saved.lat}, ${saved.lng}`}.`;
      }
    }
  ];
}
