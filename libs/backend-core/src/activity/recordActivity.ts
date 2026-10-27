import logger from '../logging/logger';
import { UserDay } from './UserDay';
import { isActivityModule, type ActivityModule, type ActivityPlatform } from './modules';

export interface ActivityInput {
  userId: string;
  /** `visit`: the app was opened, or came back after a long absence. `open`: a page was opened. */
  kind: 'visit' | 'open';
  /** Required for `open`. */
  module?: ActivityModule;
  platform: ActivityPlatform;
  country?: string;
  /** For tests. */
  now?: Date;
}

/** The UTC day a moment falls on, as it is stored. */
export const dayOf = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * Counts one visit or one page open against the person's day.
 *
 * A single upsert, so the first event of a day creates it and every later one
 * only increments, with no read in between for two tabs to race on.
 *
 * Never throws, for the reason the audit writes never do: a counter that can
 * fail the request it describes is worse than no counter. A failure is logged
 * and the day is simply undercounted.
 *
 * Returns whether it was recorded, which only the endpoint's tests care about.
 */
export async function recordActivity(input: ActivityInput): Promise<boolean> {
  try {
    if (!input.userId) return false;
    if (input.kind === 'open' && !isActivityModule(input.module)) return false;

    const now = input.now ?? new Date();
    // A page open is not another device, so only a visit adds to the platform split.
    const inc: Record<string, number> =
      input.kind === 'visit' ? { visits: 1, [`platform.${input.platform}`]: 1 } : { [`modules.${input.module}`]: 1 };

    await UserDay.updateOne(
      { userId: input.userId, day: dayOf(now) },
      {
        $inc: inc,
        $min: { firstAt: now },
        $max: { lastAt: now },
        ...(input.country ? { $set: { country: input.country } } : {}),
        // A day the backfill wrote is a guess; once someone is seen that day it
        // is a counted one, and should no longer be drawn as an undercount.
        ...(input.kind === 'visit' ? { $unset: { backfilled: '' } } : {})
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    logger.warn('Could not record activity', { error: (error as Error)?.message, kind: input.kind });
    return false;
  }
}
