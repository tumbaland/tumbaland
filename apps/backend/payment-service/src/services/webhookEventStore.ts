import { WebhookEvent } from '../models/WebhookEvent';

/**
 * Which Stripe events have been applied.
 *
 * Kept in Mongo, not in memory: a deploy empties a process, and Stripe's
 * retries are exactly what arrives right after one. Entries expire on their
 * own (see the model), so the collection stays small.
 */
export function ensureEventStore() {
  return {
    has: async (id: string): Promise<boolean> => (await WebhookEvent.exists({ eventId: id })) !== null,
    add: async (id: string): Promise<void> => {
      await WebhookEvent.updateOne({ eventId: id }, { $setOnInsert: { eventId: id } }, { upsert: true });
    }
  };
}
