jest.mock('../models/DashboardSettings', () => ({
  DashboardSettings: { findOne: jest.fn(), findOneAndUpdate: jest.fn() }
}));

import { DashboardSettings } from '../models/DashboardSettings';
import { getDashboardSettings, saveDashboardSettings } from './dashboardSettings.service';

const mockedFindOne = DashboardSettings.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = DashboardSettings.findOneAndUpdate as unknown as jest.Mock;

describe('getDashboardSettings', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(getDashboardSettings('u1', [], 'g9')).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFindOne).not.toHaveBeenCalled();
  });

  it('returns default settings when none are stored yet', async () => {
    mockedFindOne.mockResolvedValue(null);

    const settings = await getDashboardSettings('u1', []);

    expect(settings).toEqual({ highlightTypeIds: [], hiddenTypeIds: [], startDate: null });
  });

  it('returns stored personal settings', async () => {
    mockedFindOne.mockResolvedValue({ highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'] });

    const settings = await getDashboardSettings('u1', []);

    expect(mockedFindOne).toHaveBeenCalledWith({ userId: 'u1', $or: [{ groupId: { $exists: false } }, { groupId: null }] });
    expect(settings).toEqual({ highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'], startDate: null });
  });

  it('returns a stored start date', async () => {
    mockedFindOne.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' });

    const settings = await getDashboardSettings('u1', []);

    expect(settings.startDate).toBe('2024-01-18');
  });

  it('returns stored group settings', async () => {
    mockedFindOne.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: ['t2'] });

    await getDashboardSettings('u1', ['g1'], 'g1');

    expect(mockedFindOne).toHaveBeenCalledWith({ groupId: 'g1' });
  });
});

describe('saveDashboardSettings', () => {
  it('denies access to a group the user is not a member of', async () => {
    await expect(
      saveDashboardSettings({ highlightTypeIds: [], hiddenTypeIds: [] }, 'u1', [], 'g9')
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts personal settings', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ highlightTypeIds: ['t1'], hiddenTypeIds: [] });

    const settings = await saveDashboardSettings({ highlightTypeIds: ['t1'], hiddenTypeIds: [] }, 'u1', []);

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1', $or: [{ groupId: { $exists: false } }, { groupId: null }] },
      {
        $set: { highlightTypeIds: ['t1'], hiddenTypeIds: [] },
        $unset: { startDate: '' },
        $setOnInsert: { userId: 'u1' }
      },
      { new: true, upsert: true }
    );
    expect(settings).toEqual({ highlightTypeIds: ['t1'], hiddenTypeIds: [], startDate: null });
  });

  it('stores a start date when one is given', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' });

    const settings = await saveDashboardSettings(
      { highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' },
      'u1',
      []
    );

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: { highlightTypeIds: [], hiddenTypeIds: [], startDate: '2024-01-18' }
      }),
      { new: true, upsert: true }
    );
    expect(settings.startDate).toBe('2024-01-18');
  });

  it('unsets the start date when it is cleared', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [] });

    await saveDashboardSettings({ highlightTypeIds: [], hiddenTypeIds: [], startDate: '' }, 'u1', []);

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $unset: { startDate: '' } }),
      { new: true, upsert: true }
    );
  });

  it('upserts group settings with the group id set on insert', async () => {
    mockedFindOneAndUpdate.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [] });

    await saveDashboardSettings({ highlightTypeIds: [], hiddenTypeIds: [] }, 'u1', ['g1'], 'g1');

    expect(mockedFindOneAndUpdate).toHaveBeenCalledWith(
      { groupId: 'g1' },
      {
        $set: { highlightTypeIds: [], hiddenTypeIds: [] },
        $unset: { startDate: '' },
        $setOnInsert: { userId: 'u1', groupId: 'g1' }
      },
      { new: true, upsert: true }
    );
  });
});
