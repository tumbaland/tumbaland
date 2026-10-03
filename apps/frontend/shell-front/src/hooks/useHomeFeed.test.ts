import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@tumbaland/frontend-core', async () => {
  const actual = await vi.importActual<typeof import('@tumbaland/frontend-core')>('@tumbaland/frontend-core');
  return { ...actual, useTenantFilter: () => undefined };
});

vi.mock('../services/homeApi', () => ({
  getMemories: vi.fn(),
  getMilestones: vi.fn(),
  getRecentPhotos: vi.fn(),
  getRecentActivities: vi.fn()
}));

vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: vi.fn()
}));

import { useHomeFeed } from './useHomeFeed';
import { getMemories, getMilestones, getRecentActivities, getRecentPhotos } from '../services/homeApi';
import { getGlobalConfig } from '../config/ConfigProvider';

const configured = { ALBUM_API_URL: 'https://album.example', RELATIONSHIP_API_URL: 'https://journal.example' };

const memories = { date: '2026-09-20', totalPhotos: 2, years: [] };
const photos = [{ _id: 'p1', originalName: 'p1.jpg', albumId: 'a1', createdAt: '2026-09-19T00:00:00Z' }];
const activities = [{ _id: 'e1', date: '2026-09-19T00:00:00Z' }];
const milestones = { since: '2024-01-01', daysTogether: 628, recent: [], upcoming: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGlobalConfig).mockReturnValue(configured as ReturnType<typeof getGlobalConfig>);
  vi.mocked(getMemories).mockResolvedValue(memories);
  vi.mocked(getRecentPhotos).mockResolvedValue(photos);
  vi.mocked(getRecentActivities).mockResolvedValue(activities);
  vi.mocked(getMilestones).mockResolvedValue(milestones);
});

it('loads all four feeds', async () => {
  const { result } = renderHook(() => useHomeFeed());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.memories).toEqual(memories);
  expect(result.current.photos).toEqual(photos);
  expect(result.current.activities).toEqual(activities);
  expect(result.current.milestones).toEqual(milestones);
});

it('keeps the sections that worked when one feed fails', async () => {
  // A home page that blanks because one of three calls failed is worse than
  // one missing a strip of photos.
  vi.mocked(getRecentPhotos).mockRejectedValue(new Error('album down'));

  const { result } = renderHook(() => useHomeFeed());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.photos).toEqual([]);
  expect(result.current.memories).toEqual(memories);
  expect(result.current.activities).toEqual(activities);
});

it('finishes loading even when every feed fails', async () => {
  vi.mocked(getMemories).mockRejectedValue(new Error('down'));
  vi.mocked(getRecentPhotos).mockRejectedValue(new Error('down'));
  vi.mocked(getRecentActivities).mockRejectedValue(new Error('down'));
  vi.mocked(getMilestones).mockRejectedValue(new Error('down'));

  const { result } = renderHook(() => useHomeFeed());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.memories).toBeNull();
  expect(result.current.milestones).toBeNull();
});

it('asks for nothing a front was not given a URL for', async () => {
  // Deployed without the new config, the page is what it was before.
  vi.mocked(getGlobalConfig).mockReturnValue({} as ReturnType<typeof getGlobalConfig>);

  const { result } = renderHook(() => useHomeFeed());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(getMemories).not.toHaveBeenCalled();
  expect(getRecentPhotos).not.toHaveBeenCalled();
  expect(getRecentActivities).not.toHaveBeenCalled();
  expect(getMilestones).not.toHaveBeenCalled();
});

it('scopes every call to the tenant being read', async () => {
  // The journal call included: without a groupId the service answers with the
  // caller's personal entries alone, so a shared journal came back empty.
  renderHook(() => useHomeFeed());

  await waitFor(() => expect(getMemories).toHaveBeenCalled());

  expect(getMemories).toHaveBeenCalledWith(undefined);
  expect(getRecentPhotos).toHaveBeenCalledWith(undefined);
  expect(getRecentActivities).toHaveBeenCalledWith(undefined);
  expect(getMilestones).toHaveBeenCalledWith(undefined);
});
