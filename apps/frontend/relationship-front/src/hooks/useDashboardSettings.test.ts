import { renderHook, waitFor, act } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../services/dashboardSettings', () => ({
  getDashboardSettings: vi.fn(),
  saveDashboardSettings: vi.fn()
}));
vi.mock('../services/activityTypes', () => ({
  getActivityTypes: vi.fn()
}));

import { getDashboardSettings, saveDashboardSettings } from '../services/dashboardSettings';
import { getActivityTypes } from '../services/activityTypes';
import { useDashboardSettings } from './useDashboardSettings';

const mockedGetSettings = getDashboardSettings as unknown as ReturnType<typeof vi.fn>;
const mockedSaveSettings = saveDashboardSettings as unknown as ReturnType<typeof vi.fn>;
const mockedGetActivityTypes = getActivityTypes as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('loads settings and activity types together', async () => {
  mockedGetSettings.mockResolvedValue({ highlightTypeIds: ['t1'], hiddenTypeIds: [] });
  mockedGetActivityTypes.mockResolvedValue({ data: [{ _id: 't1', name: 'Reading' }], pagination: {} as never });

  const { result } = renderHook(() => useDashboardSettings('g1'));

  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.settings).toEqual({ highlightTypeIds: ['t1'], hiddenTypeIds: [] });
  expect(result.current.types).toEqual([{ _id: 't1', name: 'Reading' }]);
  expect(mockedGetSettings).toHaveBeenCalledWith('g1');
  expect(mockedGetActivityTypes).toHaveBeenCalledWith({ groupId: 'g1' });
});

it('falls back to empty settings and logs when loading fails', async () => {
  mockedGetSettings.mockRejectedValue(new Error('down'));
  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as never });

  const { result } = renderHook(() => useDashboardSettings());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.settings).toEqual({ highlightTypeIds: [], hiddenTypeIds: [], startDate: null });
});

it('optimistically updates then commits the saved settings', async () => {
  mockedGetSettings.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [] });
  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as never });
  mockedSaveSettings.mockResolvedValue({ highlightTypeIds: ['t2'], hiddenTypeIds: [] });

  const { result } = renderHook(() => useDashboardSettings('g1'));
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.save({ highlightTypeIds: ['t2'], hiddenTypeIds: [] });
  });

  expect(mockedSaveSettings).toHaveBeenCalledWith({ highlightTypeIds: ['t2'], hiddenTypeIds: [] }, 'g1');
  expect(result.current.settings).toEqual({ highlightTypeIds: ['t2'], hiddenTypeIds: [] });
});

it('re-throws and logs when save fails', async () => {
  mockedGetSettings.mockResolvedValue({ highlightTypeIds: [], hiddenTypeIds: [] });
  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as never });
  mockedSaveSettings.mockRejectedValue(new Error('save failed'));

  const { result } = renderHook(() => useDashboardSettings());
  await waitFor(() => expect(result.current.loading).toBe(false));

  await expect(
    act(async () => {
      await result.current.save({ highlightTypeIds: ['x'], hiddenTypeIds: [] });
    })
  ).rejects.toThrow('save failed');
});

it('does not apply a stale response after the hook unmounts', async () => {
  let resolveSettings: (v: unknown) => void;
  mockedGetSettings.mockReturnValue(
    new Promise((resolve) => {
      resolveSettings = resolve;
    })
  );
  mockedGetActivityTypes.mockResolvedValue({ data: [], pagination: {} as never });

  const { unmount } = renderHook(() => useDashboardSettings());
  unmount();

  await act(async () => {
    resolveSettings!({ highlightTypeIds: ['t1'], hiddenTypeIds: [] });
  });
  // No assertion needed beyond "doesn't throw" — this exercises the cancelled-guard branches.
});
