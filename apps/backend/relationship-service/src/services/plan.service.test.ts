import mongoose from 'mongoose';

jest.mock('./activity.service', () => ({ isTypeAccessible: jest.fn() }));

import { Plan } from '../models/Plan';
import { Activity } from '../models/Activity';
import { ActivityType } from '../models/ActivityType';
import { isTypeAccessible } from './activity.service';
import {
  createPlan,
  deletePlan,
  listPlans,
  logPlan,
  scheduleFields,
  toPlanView,
  updatePlan
} from './plan.service';

const mockedTypeAccessible = isTypeAccessible as jest.Mock;

// Real documents, so the schema and toObject run as they would; only the
// round trips to the database are stubbed.
let planSave: jest.SpyInstance;
let activitySave: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  planSave = jest.spyOn(Plan.prototype, 'save').mockImplementation(function (this: unknown) {
    return Promise.resolve(this);
  });
  jest.spyOn(Plan.prototype, 'populate').mockImplementation(function (this: unknown) {
    return Promise.resolve(this);
  } as never);
  activitySave = jest.spyOn(Activity.prototype, 'save').mockImplementation(function (this: unknown) {
    return Promise.resolve(this);
  });
  mockedTypeAccessible.mockResolvedValue(true);
});

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
const typeId = new mongoose.Types.ObjectId().toString();
const NOW = new Date('2026-10-12T12:00:00Z');

const storedPlan = (over: Record<string, unknown> = {}) =>
  new Plan({
    title: 'Concert',
    date: day('2026-10-16'),
    time: '19:00',
    timeZone: 'Europe/Tallinn',
    remindBefore: 60,
    ...scheduleFields({ date: day('2026-10-16'), time: '19:00', timeZone: 'Europe/Tallinn', remindBefore: 60 }, NOW),
    userId: 'u1',
    groupId: 'g1',
    ...over
  });

describe('scheduleFields', () => {
  it('starts a timed plan at its local time and reminds before it', () => {
    const fields = scheduleFields(
      { date: day('2026-10-16'), time: '19:00', timeZone: 'Europe/Tallinn', remindBefore: 60 },
      NOW
    );
    expect(fields.startsAt.toISOString()).toBe('2026-10-16T16:00:00.000Z');
    expect(fields.remindAt?.toISOString()).toBe('2026-10-16T15:00:00.000Z');
    expect(fields.remindedAt).toBeNull();
  });

  it('reminds about an all-day plan from 09:00 that day', () => {
    const fields = scheduleFields({ date: day('2026-10-16'), timeZone: 'Europe/Tallinn', remindBefore: 0 }, NOW);
    expect(fields.startsAt.toISOString()).toBe('2026-10-15T21:00:00.000Z');
    expect(fields.remindAt?.toISOString()).toBe('2026-10-16T06:00:00.000Z');
  });

  it('"the day before" an all-day plan is 09:00 the previous day', () => {
    const fields = scheduleFields({ date: day('2026-10-16'), timeZone: 'Europe/Tallinn', remindBefore: 1440 }, NOW);
    expect(fields.remindAt?.toISOString()).toBe('2026-10-15T06:00:00.000Z');
  });

  it('has no reminder when none was asked for', () => {
    expect(scheduleFields({ date: day('2026-10-16'), timeZone: 'UTC', remindBefore: null }, NOW)).toMatchObject({
      remindAt: null,
      remindedAt: null
    });
  });

  it('marks a reminder whose time has already gone as done, so it is never sent', () => {
    const fields = scheduleFields(
      { date: day('2026-10-12'), time: '15:30', timeZone: 'Europe/Tallinn', remindBefore: 60 },
      NOW // 15:00 in Tallinn, past the 14:30 reminder
    );
    expect(fields.remindAt?.toISOString()).toBe('2026-10-12T11:30:00.000Z');
    expect(fields.remindedAt).toEqual(NOW);
  });
});

describe('createPlan', () => {
  it('saves a timed plan in a group with an hour-before reminder by default', async () => {
    const plan = await createPlan(
      { title: 'Concert', date: day('2026-10-16'), time: '19:00', timeZone: 'Europe/Tallinn', groupId: 'g1' },
      'u1',
      ['g1']
    );
    expect(planSave).toHaveBeenCalled();
    expect(plan).toMatchObject({
      title: 'Concert',
      date: '2026-10-16',
      time: '19:00',
      remindBefore: 60,
      groupId: 'g1',
      userId: 'u1',
      typeId: null,
      loggedActivityId: null
    });
  });

  it('reminds about an all-day plan that morning by default, in Tallinn when no zone is given', async () => {
    const plan = await createPlan({ title: 'Weekend away', date: day('2030-06-01') }, 'u1', []);
    expect(plan).toMatchObject({ time: null, timeZone: 'Europe/Tallinn', remindBefore: 0 });
    expect(plan.remindAt?.toISOString()).toBe('2030-06-01T06:00:00.000Z');
  });

  it('keeps no reminder when the caller turned it off', async () => {
    const plan = await createPlan(
      { title: 'Dinner', date: day('2030-06-01'), time: '19:00', remindBefore: null },
      'u1',
      []
    );
    expect(plan.remindBefore).toBeNull();
    expect(plan.remindAt).toBeNull();
  });

  it('refuses a group the caller is not in', async () => {
    await expect(createPlan({ title: 'x', date: day('2030-06-01'), groupId: 'g2' }, 'u1', ['g1'])).rejects.toThrow(
      'Access denied'
    );
  });

  it('checks the activity type against the plan’s scope', async () => {
    mockedTypeAccessible.mockResolvedValue(false);
    await expect(
      createPlan({ title: 'x', date: day('2030-06-01'), typeId, groupId: 'g1' }, 'u1', ['g1'])
    ).rejects.toThrow('Invalid or inaccessible activity type');
    expect(mockedTypeAccessible).toHaveBeenCalledWith(typeId, 'u1', ['g1'], 'g1');
  });
});

describe('listPlans', () => {
  const chain = (docs: unknown[]) => {
    const limit = jest.fn().mockResolvedValue(docs);
    const sort = jest.fn().mockReturnValue({ limit });
    const populate = jest.fn().mockReturnValue({ sort });
    return { populate, sort, limit };
  };

  it('reads a group’s plans in a range of days, earliest first', async () => {
    const c = chain([storedPlan()]);
    const find = jest.spyOn(Plan, 'find').mockReturnValue(c as never);

    const plans = await listPlans({
      userId: 'u1',
      userGroupIds: ['g1'],
      groupId: 'g1',
      startDate: day('2026-10-01'),
      endDate: day('2026-10-31')
    });

    expect(find).toHaveBeenCalledWith({ groupId: 'g1', date: { $gte: day('2026-10-01'), $lte: day('2026-10-31') } });
    expect(c.sort).toHaveBeenCalledWith({ date: 1, time: 1, createdAt: 1 });
    expect(c.limit).toHaveBeenCalledWith(100);
    expect(plans[0]).toMatchObject({ title: 'Concert', date: '2026-10-16' });
  });

  it('keeps only the ones not yet logged when asked for upcoming plans', async () => {
    const find = jest.spyOn(Plan, 'find').mockReturnValue(chain([]) as never);
    await listPlans({ userId: 'u1', userGroupIds: [], upcoming: true, startDate: day('2026-10-12'), limit: 500 });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', loggedActivityId: null, date: { $gte: day('2026-10-12') } })
    );
  });

  it('refuses a group the caller is not in', async () => {
    await expect(listPlans({ userId: 'u1', userGroupIds: [], groupId: 'g1' })).rejects.toThrow('Access denied');
  });
});

describe('updatePlan', () => {
  it('reschedules the reminder when the plan moves, even one already sent', async () => {
    const existing = storedPlan({ remindedAt: new Date('2026-10-16T15:00:00Z') });
    const findOne = jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);

    const plan = await updatePlan(existing.id, { date: day('2026-10-17') }, 'u1', ['g1']);

    expect(findOne).toHaveBeenCalledWith({
      _id: existing.id,
      $or: [{ userId: 'u1', groupId: null }, { groupId: { $in: ['g1'] } }]
    });
    expect(plan.date).toBe('2026-10-17');
    expect(plan.remindAt?.toISOString()).toBe('2026-10-17T15:00:00.000Z');
    expect(plan.remindedAt).toBeNull();
  });

  it('leaves the schedule alone for a rename', async () => {
    const existing = storedPlan({ remindedAt: new Date('2026-10-16T15:00:00Z') });
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    const plan = await updatePlan(existing.id, { title: 'Concert at Saku', notes: 'Tickets in email' }, 'u1', ['g1']);
    expect(plan).toMatchObject({ title: 'Concert at Saku', notes: 'Tickets in email' });
    expect(plan.remindedAt?.toISOString()).toBe('2026-10-16T15:00:00.000Z');
  });

  it('sets and clears the type and the place', async () => {
    const existing = storedPlan();
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    let plan = await updatePlan(existing.id, { typeId, location: { label: 'Saku Arena', lat: 59.4, lng: 24.7 } }, 'u1', ['g1']);
    expect(plan).toMatchObject({ typeId, location: { label: 'Saku Arena' } });
    plan = await updatePlan(existing.id, { typeId: null, location: null }, 'u1', ['g1']);
    expect(plan).toMatchObject({ typeId: null, location: null });
  });

  it('turns a timed plan into an all-day one', async () => {
    const existing = storedPlan();
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    const plan = await updatePlan(existing.id, { time: null, remindBefore: 0, timeZone: 'Europe/Tallinn' }, 'u1', ['g1']);
    expect(plan.time).toBeNull();
    expect(plan.remindAt?.toISOString()).toBe('2026-10-16T06:00:00.000Z');
  });

  it('is not found outside the caller’s reach, or for an id that is not one', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue(null);
    await expect(updatePlan(new mongoose.Types.ObjectId().toString(), { title: 'x' }, 'u1', [])).rejects.toThrow(
      'Plan not found'
    );
    await expect(updatePlan('nope', { title: 'x' }, 'u1', [])).rejects.toThrow('Plan not found');
  });
});

describe('deletePlan', () => {
  it('deletes a plan the caller can reach', async () => {
    const existing = storedPlan();
    const deleteOne = jest.spyOn(existing, 'deleteOne').mockResolvedValue(existing as never);
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    await deletePlan(existing.id, 'u1', ['g1']);
    expect(deleteOne).toHaveBeenCalled();
  });
});

describe('logPlan', () => {
  const after = new Date('2026-10-17T10:00:00Z');

  it('makes an entry on the plan’s day in its scope, with the title and place', async () => {
    const existing = storedPlan({ location: { label: 'Saku Arena', lat: 59.4, lng: 24.7 } });
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    jest.spyOn(ActivityType, 'findById').mockResolvedValue({ valueType: 'string', hasLocation: true } as never);

    const { plan, activityId } = await logPlan(existing.id, typeId, 'u1', ['g1'], after);

    expect(activitySave).toHaveBeenCalled();
    const activity = activitySave.mock.contexts[0] as InstanceType<typeof Activity>;
    expect(activity.toObject()).toMatchObject({
      date: day('2026-10-16'),
      description: 'Concert',
      location: { label: 'Saku Arena' },
      groupId: 'g1',
      userId: 'u1'
    });
    expect(plan.loggedActivityId).toBe(activityId);
    expect(plan.typeId).toBe(typeId);
  });

  it('leaves out what the type does not take', async () => {
    const existing = storedPlan({ typeId, location: { label: 'Home', lat: 1, lng: 1 } });
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    jest.spyOn(ActivityType, 'findById').mockResolvedValue({ valueType: 'boolean', hasLocation: false } as never);

    await logPlan(existing.id, undefined, 'u1', ['g1'], after);

    const activity = (activitySave.mock.contexts[0] as InstanceType<typeof Activity>).toObject();
    expect(activity.description).toBeUndefined();
    expect(activity.location).toBeUndefined();
  });

  it('can be logged on its own day just after midnight in Tallinn', async () => {
    const existing = storedPlan({ typeId });
    jest.spyOn(Plan, 'findOne').mockResolvedValue(existing);
    jest.spyOn(ActivityType, 'findById').mockResolvedValue({ valueType: 'string' } as never);
    // 00:30 on the 16th in Tallinn, still the 15th in UTC
    await expect(logPlan(existing.id, undefined, 'u1', ['g1'], new Date('2026-10-15T21:30:00Z'))).resolves.toBeTruthy();
  });

  it('refuses a plan whose day has not come', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue(storedPlan({ typeId }));
    await expect(logPlan(new mongoose.Types.ObjectId().toString(), undefined, 'u1', ['g1'], NOW)).rejects.toThrow(
      'A plan can be logged once its day has come'
    );
  });

  it('refuses to log one twice', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue(storedPlan({ loggedActivityId: new mongoose.Types.ObjectId() }));
    await expect(logPlan(new mongoose.Types.ObjectId().toString(), typeId, 'u1', ['g1'], after)).rejects.toThrow(
      'This plan is already in the journal'
    );
  });

  it('needs a type when the plan has none', async () => {
    jest.spyOn(Plan, 'findOne').mockResolvedValue(storedPlan());
    await expect(logPlan(new mongoose.Types.ObjectId().toString(), undefined, 'u1', ['g1'], after)).rejects.toThrow(
      'Choose an activity type to log it as'
    );
  });
});

describe('toPlanView', () => {
  it('returns a populated type alongside its id', () => {
    const plan = storedPlan();
    const type = { _id: new mongoose.Types.ObjectId(), name: 'Concerts', color: '#ff0000' };
    jest.spyOn(plan, 'toObject').mockReturnValue({ ...plan.toObject(), typeId: type } as never);
    expect(toPlanView(plan)).toMatchObject({ typeId: String(type._id), type: { name: 'Concerts' } });
  });
});
