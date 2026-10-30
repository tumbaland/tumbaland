/**
 * A cap on how often one chat may use a lookup: so many an hour, counted per
 * key. The outside services behind the assistant's tools are shared and free,
 * and one chat in a loop should not be what gets us turned away.
 */
export interface HourlyLimit {
  /** Counts a use, and throws `message` when the key has used up the hour. */
  take: (key: string, now?: number) => void;
  /** Forgets everything counted, for tests. */
  reset: () => void;
}

const HOUR_MS = 60 * 60_000;
/** Keys that have not used the lookup for an hour are dropped once there are this many. */
const PRUNE_AT = 1_000;

export function hourlyLimit(perHour: number, message: string): HourlyLimit {
  const used = new Map<string, number[]>();
  return {
    take(key, now = Date.now()) {
      const since = now - HOUR_MS;
      const times = (used.get(key) ?? []).filter((time) => time > since);
      if (times.length >= perHour) throw new Error(message);
      used.set(key, [...times, now]);
      if (used.size > PRUNE_AT) for (const [id, list] of used) if (list.every((time) => time <= since)) used.delete(id);
    },
    reset: () => used.clear()
  };
}
