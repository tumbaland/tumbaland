jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  AuditEvent: { aggregate: jest.fn() },
  UserDay: { find: jest.fn(), bulkWrite: jest.fn() }
}));
jest.mock('../models/User', () => ({ User: { find: jest.fn() } }));

import { AuditEvent, UserDay } from '@tumbaland/backend-core';
import { User } from '../models/User';
import { backfillUserDays } from './backfillUserDays';

const aggregate = AuditEvent.aggregate as unknown as jest.Mock;
const findDays = UserDay.find as unknown as jest.Mock;
const bulkWrite = UserDay.bulkWrite as unknown as jest.Mock;
const findUsers = User.find as unknown as jest.Mock;

const lean = (rows: unknown[]) => ({ lean: jest.fn().mockResolvedValue(rows) });
const at = (iso: string) => new Date(iso);

beforeEach(() => {
  jest.clearAllMocks();
  aggregate.mockResolvedValue([]);
  findUsers.mockReturnValue(lean([]));
  findDays.mockReturnValue(lean([]));
  bulkWrite.mockImplementation(async (ops: unknown[]) => ({ upsertedCount: ops.length }));
});

describe('backfillUserDays', () => {
  it('finds the days people wrote, signed up and last signed in, and counts a day once', async () => {
    aggregate.mockResolvedValue([
      { _id: { userId: 'u1', day: '2026-10-01' }, firstAt: at('2026-10-01T08:00:00Z'), lastAt: at('2026-10-01T21:00:00Z') },
      { _id: { userId: 'u1', day: '2026-10-02' }, firstAt: at('2026-10-02T08:00:00Z'), lastAt: at('2026-10-02T08:30:00Z') }
    ]);
    findUsers.mockReturnValue(
      lean([
        // Signed up on a day they also wrote: the same day.
        { _id: 'u1', createdAt: at('2026-10-01T07:00:00Z'), lastLoginAt: at('2026-10-05T09:00:00Z') },
        { _id: 'u2', createdAt: at('2026-10-03T10:00:00Z') }
      ])
    );

    const report = await backfillUserDays({ apply: false });

    // u1: 10-01, 10-02, 10-05. u2: 10-03 (no last login).
    expect(report).toEqual({ candidates: 4, alreadyRecorded: 0, written: 0, applied: false });
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('asks only for what people did, never what assistants and keys did', async () => {
    await backfillUserDays({ apply: false });

    expect(aggregate.mock.calls[0][0][0]).toEqual({ $match: { actorKind: 'person' } });
  });

  it('writes each missing day as one backfilled visit, inserting only', async () => {
    aggregate.mockResolvedValue([
      { _id: { userId: 'u1', day: '2026-10-01' }, firstAt: at('2026-10-01T08:00:00Z'), lastAt: at('2026-10-01T21:00:00Z') }
    ]);

    const report = await backfillUserDays({ apply: true });

    expect(report).toEqual({ candidates: 1, alreadyRecorded: 0, written: 1, applied: true });
    expect(bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { userId: 'u1', day: '2026-10-01' },
            update: {
              $setOnInsert: {
                visits: 1,
                firstAt: at('2026-10-01T08:00:00Z'),
                lastAt: at('2026-10-01T21:00:00Z'),
                backfilled: true
              }
            },
            upsert: true
          }
        }
      ],
      { ordered: false }
    );
  });

  it('leaves a day that already has a row alone, so a second run writes nothing', async () => {
    aggregate.mockResolvedValue([
      { _id: { userId: 'u1', day: '2026-10-01' }, firstAt: at('2026-10-01T08:00:00Z'), lastAt: at('2026-10-01T08:00:00Z') }
    ]);
    findDays.mockReturnValue(lean([{ userId: 'u1', day: '2026-10-01' }]));

    const report = await backfillUserDays({ apply: true });

    expect(report).toEqual({ candidates: 1, alreadyRecorded: 1, written: 0, applied: true });
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('writes in chunks', async () => {
    findUsers.mockReturnValue(
      lean(Array.from({ length: 2500 }, (_, i) => ({ _id: `u${i}`, createdAt: at('2026-10-01T08:00:00Z') })))
    );

    const report = await backfillUserDays({ apply: true });

    expect(bulkWrite).toHaveBeenCalledTimes(3);
    expect(report.written).toBe(2500);
  });
});
