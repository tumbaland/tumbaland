import { planReminderPush, planReminderText, planWhenFromNow } from './planText';

const plan = {
  id: 'p1',
  title: 'Concert',
  date: '2026-10-16',
  time: '19:00',
  timeZone: 'Europe/Tallinn',
  place: 'Saku Arena'
};

describe('planReminderText', () => {
  it('says the day itself, since the message stays in the thread', () => {
    expect(planReminderText(plan)).toBe('Concert on Friday 16 October at 19:00 · Saku Arena');
    expect(planReminderText({ ...plan, time: null, place: null })).toBe('Concert on Friday 16 October');
  });
});

describe('planWhenFromNow', () => {
  it('says today and tomorrow in the plan’s own zone', () => {
    expect(planWhenFromNow(plan, new Date('2026-10-16T15:00:00Z'))).toBe('today at 19:00');
    expect(planWhenFromNow(plan, new Date('2026-10-15T06:00:00Z'))).toBe('tomorrow at 19:00');
    expect(planWhenFromNow(plan, new Date('2026-10-10T06:00:00Z'))).toBe('on Friday 16 October at 19:00');
  });

  it('is already today at 01:00 in Tallinn, while UTC is on the day before', () => {
    expect(planWhenFromNow({ ...plan, time: null }, new Date('2026-10-15T22:00:00Z'))).toBe('today');
  });
});

it('puts the place on the notification', () => {
  expect(planReminderPush(plan, new Date('2026-10-16T15:00:00Z'))).toBe('Concert today at 19:00 · Saku Arena');
});
