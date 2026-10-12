import { logger } from '@tumbaland/backend-core';

/**
 * chat-service's internal route for the one thing the journal tells Chat: a
 * plan is coming up. Chat posts it into the group's chat, which is where the
 * unread badge and the phone notification already come from.
 *
 * The container-network address, as album-service's chat client uses.
 */
const baseUrl = (): string => (process.env.CHAT_INTERNAL_URL || 'http://localhost:4004').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;

export interface PlanReminder {
  planId: string;
  /** Absent for a personal plan: Chat then notifies its owner directly. */
  groupId?: string;
  userId: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD, the last day of a trip */
  endDate?: string;
  /** HH:mm, absent all day */
  time?: string;
  timeZone: string;
  place?: string;
  /** The reminder this is, so a retry after a timeout posts it once. */
  remindAt: string;
}

/** Whether Chat took it. Never throws: the scheduler decides what a failure means. */
export async function postPlanReminder(reminder: PlanReminder): Promise<boolean> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) {
    logger.warn('INTERNAL_SERVICE_TOKEN is not set; plan reminders cannot be sent');
    return false;
  }

  try {
    const response = await fetch(`${baseUrl()}/internal/plan-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
        'x-service-id': process.env.SERVICE_NAME || 'relationship-service'
      },
      body: JSON.stringify(reminder),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) logger.warn('chat-service plan reminder call failed', { status: response.status });
    return response.ok;
  } catch (error) {
    logger.warn('Could not reach chat-service with a plan reminder', { error: (error as Error).message });
    return false;
  }
}
