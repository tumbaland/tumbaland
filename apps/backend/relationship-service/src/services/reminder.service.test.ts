import mongoose from 'mongoose';

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('./chatClient', () => ({ postPlanReminder: jest.fn() }));

import cron from 'node-cron';
import { Plan } from '../models/Plan';
import { postPlanReminder } from './chatClient';
import { sendDueReminders, startReminderScheduler } from './reminder.service';

const mockedPost = postPlanReminder as jest.Mock;
const NOW = new Date('2026-10-16T15:00:30Z');

const duePlan = (over: Record<string, unknown> = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  title: 'Concert',
  date: new Date('2026-10-16T00:00:00Z'),
  time: '19:00',
  timeZone: 'Europe/Tallinn',
  remindAt: new Date('2026-10-16T15:00:00Z'),
  userId: 'u1',
  groupId: 'g1',
  location: { label: 'Saku Arena', lat: 59.4, lng: 24.7 },
  ...over
});

let claim: jest.SpyInstance;
let release: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  claim = jest.spyOn(Plan, 'findOneAndUpdate');
  release = jest.spyOn(Plan, 'updateOne').mockResolvedValue({} as never);
  mockedPost.mockResolvedValue(true);
});

afterEach(() => jest.useRealTimers());

it('claims each due plan before sending it, and sends it to the group’s chat', async () => {
  const plan = duePlan();
  claim.mockResolvedValueOnce(plan).mockResolvedValueOnce(null);

  expect(await sendDueReminders(NOW)).toEqual({ sent: 1, skipped: 0, failed: 0 });

  expect(claim).toHaveBeenCalledWith(
    // `$nin` is the run's list of plans already tried, which grows as it goes
    { _id: { $nin: expect.any(Array) }, remindedAt: null, remindAt: { $ne: null, $lte: NOW } },
    { $set: { remindedAt: NOW } },
    { sort: { remindAt: 1 }, returnDocument: 'after' }
  );
  expect(mockedPost).toHaveBeenCalledWith({
    planId: String(plan._id),
    groupId: 'g1',
    userId: 'u1',
    title: 'Concert',
    date: '2026-10-16',
    time: '19:00',
    timeZone: 'Europe/Tallinn',
    place: 'Saku Arena',
    remindAt: '2026-10-16T15:00:00.000Z'
  });
});

it('sends the last day of a trip', async () => {
  claim.mockResolvedValueOnce(duePlan({ endDate: new Date('2026-10-18T00:00:00Z') })).mockResolvedValueOnce(null);
  await sendDueReminders(NOW);
  expect(mockedPost.mock.calls[0][0].endDate).toBe('2026-10-18');
});

it('leaves out what a personal all-day plan does not have', async () => {
  claim.mockResolvedValueOnce(duePlan({ groupId: undefined, time: null, location: null })).mockResolvedValueOnce(null);
  await sendDueReminders(NOW);
  const sent = mockedPost.mock.calls[0][0];
  expect(sent).not.toHaveProperty('groupId');
  expect(sent).not.toHaveProperty('time');
  expect(sent).not.toHaveProperty('place');
  expect(sent).not.toHaveProperty('endDate');
});

it('drops a reminder more than an hour late instead of sending it', async () => {
  claim.mockResolvedValueOnce(duePlan({ remindAt: new Date('2026-10-16T13:30:00Z') })).mockResolvedValueOnce(null);
  expect(await sendDueReminders(NOW)).toEqual({ sent: 0, skipped: 1, failed: 0 });
  expect(mockedPost).not.toHaveBeenCalled();
});

it('releases a reminder Chat did not take, for the next run, without retrying it in this one', async () => {
  const plan = duePlan();
  claim.mockResolvedValueOnce(plan).mockResolvedValueOnce(null);
  mockedPost.mockResolvedValue(false);

  expect(await sendDueReminders(NOW)).toEqual({ sent: 0, skipped: 0, failed: 1 });

  expect(release).toHaveBeenCalledWith({ _id: plan._id, remindedAt: NOW }, { $set: { remindedAt: null } });
  expect(claim.mock.calls[1][0]._id).toEqual({ $nin: [plan._id] });
});

it('stops after a bounded number in one run', async () => {
  claim.mockImplementation(() => Promise.resolve(duePlan()));
  const result = await sendDueReminders(NOW);
  expect(result.sent).toBe(50);
});

/**
 * Only the clock is frozen: the plan's dates are fixed, so "now" must be too,
 * or the test changes meaning as the calendar passes them. Timers stay real
 * for the database and promise code under test.
 */
const freezeClockAt = (now: Date) =>
  jest.useFakeTimers({
    now,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'hrtime',
      'performance'
    ]
  });

it('runs every minute, and never two runs at once', async () => {
  // The scheduler reads the clock itself; at the real time the plan here would be days late and dropped.
  freezeClockAt(NOW);
  startReminderScheduler();
  const [[expression, task]] = (cron.schedule as jest.Mock).mock.calls;
  expect(expression).toBe('* * * * *');

  let finish!: (value: null) => void;
  claim.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  const first = task();
  await task(); // skipped: the first is still running
  finish(null);
  await first;
  expect(claim).toHaveBeenCalledTimes(1);

  claim.mockRejectedValueOnce(new Error('db down'));
  await expect(task()).resolves.toBeUndefined();

  claim.mockResolvedValueOnce(duePlan()).mockResolvedValueOnce(null);
  await task();
  expect(mockedPost).toHaveBeenCalledTimes(1);
});
