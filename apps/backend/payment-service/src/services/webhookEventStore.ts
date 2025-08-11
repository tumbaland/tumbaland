// Simple in-memory processed event ID store (non-persistent). Replace with Redis or DB for scaling.
const processed = new Set<string>();

export function ensureEventStore() {
  return {
    has: (id: string) => processed.has(id),
    add: (id: string) => processed.add(id)
  };
}
