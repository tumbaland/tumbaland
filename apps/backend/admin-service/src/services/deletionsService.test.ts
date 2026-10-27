import { UsageMeter } from '@tumbaland/backend-core';
import { AdminActivity, AdminAlbum, AdminGroup } from '../models/readModels';
import { activeDay, at, FORBIDDEN_FIELDS, keysOf, user } from '../test/seed';
import { clearDb, startDb, stopDb } from '../test/mongo';
import { getDeletions } from './deletionsService';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

async function seed() {
  const admin = await user('admin@example.com', { roles: ['admin'] });
  const partner = await user('partner@example.com');
  // Asked on the 20th and has not been back since: the plain case.
  const ada = await user('ada@example.com', {
    firstName: 'Ada',
    lastName: 'Lovelace',
    deletionRequestedAt: at('2026-10-20T10:00:00Z')
  });
  // Asked on the 20th and opened the app on the 25th: worth a message first.
  const bob = await user('bob@example.com', { deletionRequestedAt: at('2026-10-18T10:00:00Z') });
  // Asked earlier than Bob.
  const cleo = await user('cleo@example.com', { deletionRequestedAt: at('2026-10-05T10:00:00Z') });
  // Closed, with data still in place.
  const dan = await user('dan@example.com', {
    deletionRequestedAt: at('2026-09-01T10:00:00Z'),
    deletionConfirmedAt: at('2026-09-03T10:00:00Z'),
    deletionConfirmedBy: admin.id
  });
  const eve = await user('eve@example.com', {
    deletionRequestedAt: at('2026-09-10T10:00:00Z'),
    deletionConfirmedAt: at('2026-10-01T10:00:00Z'),
    deletionConfirmedBy: admin.id
  });
  // Never asked.
  await user('fay@example.com');

  await activeDay(ada.id, '2026-10-10');
  await activeDay(bob.id, '2026-10-25');

  await AdminGroup.create([
    { name: 'Ada and partner', createdBy: ada.email, members: [{ email: ada.email, role: 'owner' }, { email: partner.email, role: 'member' }] },
    { name: 'Gone', createdBy: ada.email, deletedAt: at('2026-10-01T00:00:00Z'), members: [{ email: ada.email, role: 'owner' }] }
  ]);
  await AdminAlbum.create([
    { userId: ada.id, photoCount: 40, totalSize: 4000 },
    { userId: ada.id, photoCount: 2, totalSize: 200 },
    { userId: partner.id, photoCount: 999, totalSize: 1 }
  ]);
  await AdminActivity.create([{ userId: ada.id }, { userId: ada.id }, { userId: partner.id }]);
  await UsageMeter.create([
    { subjectId: ada.email, meter: 'storageBytes', period: 'ALL', count: 4200 },
    { subjectId: dan.email, meter: 'storageBytes', period: 'ALL', count: 77 }
  ]);
  return { admin, partner, ada, bob, cleo, dan, eve };
}

describe('getDeletions', () => {
  it('lists the requests oldest first, and the closed accounts newest first', async () => {
    await seed();

    const { requested, closed } = await getDeletions();

    expect(requested.map((entry) => entry.email)).toEqual(['cleo@example.com', 'bob@example.com', 'ada@example.com']);
    expect(closed.map((entry) => entry.email)).toEqual(['eve@example.com', 'dan@example.com']);
  });

  it('says whether they came back after asking', async () => {
    await seed();

    const { requested } = await getDeletions();
    const byEmail = Object.fromEntries(requested.map((entry) => [entry.email, entry]));

    expect(byEmail['bob@example.com']).toMatchObject({
      visitedSinceRequest: true,
      lastVisitAt: '2026-10-25T09:00:00.000Z'
    });
    // Ada was last here before she asked; Cleo never was.
    expect(byEmail['ada@example.com']).toMatchObject({ visitedSinceRequest: false, lastVisitAt: '2026-10-10T09:00:00.000Z' });
    expect(byEmail['cleo@example.com']).toMatchObject({ visitedSinceRequest: false, lastVisitAt: null });
  });

  it('shows who they share a group with, and what they own as counts', async () => {
    await seed();

    const { requested } = await getDeletions();
    const ada = requested.find((entry) => entry.email === 'ada@example.com')!;

    expect(ada.name).toBe('Ada Lovelace');
    expect(ada.requestedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(ada.groups).toEqual([{ name: 'Ada and partner', role: 'owner', otherMembers: ['partner@example.com'] }]);
    expect(ada.owns).toEqual({ albums: 2, photos: 42, activities: 2, storageBytes: 4200 });
  });

  it('shows closed accounts with when and by whom, and what is left to remove', async () => {
    await seed();

    const { closed } = await getDeletions();
    const dan = closed.find((entry) => entry.email === 'dan@example.com')!;

    expect(dan).toMatchObject({
      requestedAt: '2026-09-01T10:00:00.000Z',
      confirmedAt: '2026-09-03T10:00:00.000Z',
      confirmedBy: 'admin@example.com',
      owns: { albums: 0, photos: 0, activities: 0, storageBytes: 77 }
    });
  });

  it('leaves out accounts that never asked, and closed ones from the requests', async () => {
    await seed();

    const { requested, closed } = await getDeletions();

    expect(requested.some((entry) => entry.email === 'fay@example.com')).toBe(false);
    expect(requested.some((entry) => entry.email === 'dan@example.com')).toBe(false);
    expect([...requested, ...closed]).toHaveLength(5);
  });

  it('copes with a confirming administrator that no longer exists', async () => {
    await user('dan@example.com', {
      deletionRequestedAt: at('2026-09-01T10:00:00Z'),
      deletionConfirmedAt: at('2026-09-03T10:00:00Z'),
      deletionConfirmedBy: 'a'.repeat(24)
    });

    expect((await getDeletions()).closed[0].confirmedBy).toBeNull();
  });

  it('is empty when nobody has asked', async () => {
    await user('ada@example.com');

    expect(await getDeletions()).toEqual({ requested: [], closed: [] });
  });

  it('shows counts, never what is in the albums or entries', async () => {
    await seed();

    const keys = keysOf(await getDeletions());

    for (const forbidden of FORBIDDEN_FIELDS) expect(keys.has(forbidden)).toBe(false);
  });
});
