import cron from 'node-cron';
import mongoose from 'mongoose';
import { logger } from '@tumbaland/backend-core';
import { Plan } from '../models/Plan';
import { postPlanReminder } from './chatClient';

/**
 * A reminder this late is dropped rather than sent: after the Pi was down for
 * the evening, "Concert at 19:00" arriving at 22:00 is noise, not a reminder.
 */
export const LATE_LIMIT_MS = 60 * 60 * 1000;

/** Enough for any real minute; a bound so one run can never spin. */
const MAX_PER_RUN = 50;

/**
 * Sends every reminder that is due.
 *
 * Each plan is claimed with one atomic update before anything is sent, so two
 * replicas, or a run that overlaps a slow previous one, never send the same
 * reminder twice. A send Chat did not take is released again and retried on
 * the next run, until it is too late to be worth sending.
 */
export async function sendDueReminders(
  now: Date = new Date()
): Promise<{ sent: number; skipped: number; failed: number }> {
  const result = { sent: 0, skipped: 0, failed: 0 };
  const tried: mongoose.Types.ObjectId[] = [];

  for (let i = 0; i < MAX_PER_RUN; i++) {
    const plan = await Plan.findOneAndUpdate(
      { _id: { $nin: tried }, remindedAt: null, remindAt: { $ne: null, $lte: now } },
      { $set: { remindedAt: now } },
      { sort: { remindAt: 1 }, returnDocument: 'after' }
    );
    if (!plan) break;
    tried.push(plan._id as mongoose.Types.ObjectId);

    if (now.getTime() - plan.remindAt!.getTime() > LATE_LIMIT_MS) {
      result.skipped++;
      logger.info('Plan reminder dropped as too late', { planId: String(plan._id), remindAt: plan.remindAt });
      continue;
    }

    const ok = await postPlanReminder({
      planId: String(plan._id),
      ...(plan.groupId ? { groupId: plan.groupId } : {}),
      userId: plan.userId,
      title: plan.title,
      date: plan.date.toISOString().slice(0, 10),
      ...(plan.endDate ? { endDate: plan.endDate.toISOString().slice(0, 10) } : {}),
      ...(plan.time ? { time: plan.time } : {}),
      timeZone: plan.timeZone,
      ...(plan.location?.label ? { place: plan.location.label } : {}),
      remindAt: plan.remindAt!.toISOString()
    });

    if (ok) {
      result.sent++;
    } else {
      result.failed++;
      // Only if it is still ours: an edit in the meantime has rescheduled it.
      await Plan.updateOne({ _id: plan._id, remindedAt: now }, { $set: { remindedAt: null } });
    }
  }

  return result;
}

let running = false;

/** Every minute. A run still going when the next is due is not doubled up. */
export function startReminderScheduler(): void {
  cron.schedule('* * * * *', async () => {
    if (running) return;
    running = true;
    try {
      const { sent, skipped, failed } = await sendDueReminders();
      if (sent || skipped || failed) logger.info('Plan reminders', { sent, skipped, failed });
    } catch (error) {
      logger.warn('Plan reminder run failed', { error: (error as Error).message });
    } finally {
      running = false;
    }
  });
}
