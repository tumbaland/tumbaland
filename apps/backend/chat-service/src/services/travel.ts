import { logger } from '@tumbaland/backend-core';
import type { ClientTool } from './assistantClaude';
import { searchPlaces as geocode } from './geocodingService';
import { hourlyLimit } from './hourlyLimit';

/**
 * How far it is and how long it takes to get from one place to another, on foot,
 * by bike or by car, from OpenStreetMap's own routing servers. Free.
 *
 * Roads and paths only: no public transport, and no traffic, so a car's time is
 * how long it takes with empty roads. The answer says so.
 */

const DEFAULT_CENTER = { lat: 59.437, lng: 24.7536 };
const TIMEOUT_MS = 8_000;
const MODES = { walk: { server: 'routed-foot', words: 'Walking' }, bike: { server: 'routed-bike', words: 'Cycling' }, car: { server: 'routed-car', words: 'Driving' } } as const;
type Mode = keyof typeof MODES;

const limit = hourlyLimit(30, 'Routes have been looked up 30 times this hour in this chat. Answer from what was found.');
export const resetTravel = (): void => limit.reset();

const minutesText = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};
const distanceText = (metres: number): string => (metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`);

export function travelTools(conversationId: string): ClientTool[] {
  return [
    {
      name: 'get_route',
      description:
        'How far it is, and how long it takes, to get from one place to another on foot, by bike or by car. Give both ends as an address, a place name or a landmark. ' +
        'Roads and paths only: no public transport, and a car\'s time ignores traffic. For a bus or tram, use the web search.',
      input_schema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Where from, e.g. "Telliskivi 60a, Tallinn" or "Viru Keskus"' },
          to: { type: 'string', description: 'Where to' },
          mode: { type: 'string', enum: Object.keys(MODES), description: 'walk by default' }
        },
        required: ['from', 'to']
      },
      run: async (raw) => {
        const input = raw as { from?: string; to?: string; mode?: string };
        const mode = (Object.keys(MODES) as Mode[]).find((candidate) => candidate === input.mode) ?? 'walk';
        if (!input.from?.trim() || !input.to?.trim()) return 'Give both where from and where to.';

        const [from] = await geocode(input.from, DEFAULT_CENTER);
        if (!from) return `Could not find "${input.from}" on the map.`;
        const [to] = await geocode(input.to, DEFAULT_CENTER);
        if (!to) return `Could not find "${input.to}" on the map.`;

        try {
          limit.take(conversationId);
        } catch (error) {
          return (error as Error).message;
        }
        const url = `https://routing.openstreetmap.de/${MODES[mode].server}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Tumbaland/1.0 (chat assistant)' }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: Error) => {
          logger.warn('Routing request failed', { error: error.message });
          return null;
        });
        if (!response?.ok) return 'The route service is not answering right now. Use the web search instead.';

        const body = (await response.json().catch(() => null)) as { code?: string; routes?: Array<{ distance: number; duration: number }> } | null;
        const route = body?.routes?.[0];
        if (body?.code !== 'Ok' || !route) return `No ${MODES[mode].words.toLowerCase()} route found between those two places.`;
        return `${MODES[mode].words} from ${from.name} to ${to.name}: ${distanceText(route.distance)}, about ${minutesText(route.duration)} (OpenStreetMap routing${mode === 'car' ? ', without traffic' : ''}; no public transport).`;
      }
    }
  ];
}
