import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import type { Photo } from '../types';
import { usePhotoSelection } from './usePhotoSelection';

const photos = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }] as Photo[];

describe('usePhotoSelection', () => {
  it('starts out of select mode with nothing picked', () => {
    const { result } = renderHook(() => usePhotoSelection(photos, vi.fn()));

    expect(result.current.selectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggles photos in and out of the pick', () => {
    const { result } = renderHook(() => usePhotoSelection(photos, vi.fn()));

    act(() => result.current.toggleSelectPhoto(photos[0]!));
    act(() => result.current.toggleSelectPhoto(photos[1]!));
    act(() => result.current.toggleSelectPhoto(photos[0]!));

    expect([...result.current.selectedIds]).toEqual(['b']);
  });

  it('picks every photo on the page', () => {
    const { result } = renderHook(() => usePhotoSelection(photos, vi.fn()));

    act(() => result.current.selectAllOnPage());

    expect(result.current.selectedIds.size).toBe(3);
  });

  it('forgets the pick when select mode is toggled', () => {
    const { result } = renderHook(() => usePhotoSelection(photos, vi.fn()));
    act(() => result.current.selectAllOnPage());

    act(() => result.current.toggleSelectMode());

    expect(result.current.selectMode).toBe(true);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('deletes the pick, then leaves select mode and closes the dialog', async () => {
    const deletePhoto = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePhotoSelection(photos, deletePhoto));
    act(() => result.current.toggleSelectMode());
    act(() => result.current.toggleSelectPhoto(photos[0]!));
    act(() => result.current.toggleSelectPhoto(photos[2]!));
    act(() => result.current.setShowBulkDeleteDialog(true));

    await act(async () => result.current.confirmBulkDelete());

    expect(deletePhoto.mock.calls.map(([id]) => id)).toEqual(['a', 'c']);
    expect(result.current.selectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.showBulkDeleteDialog).toBe(false);
    expect(result.current.bulkDeleting).toBe(false);
  });

  it('keeps the pick and the dialog when a delete fails', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const deletePhoto = vi.fn().mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => usePhotoSelection(photos, deletePhoto));
    act(() => result.current.toggleSelectPhoto(photos[0]!));
    act(() => result.current.setShowBulkDeleteDialog(true));

    await act(async () => result.current.confirmBulkDelete());

    expect(alert).toHaveBeenCalledWith('Failed to delete some photos');
    expect(result.current.selectedIds.size).toBe(1);
    expect(result.current.showBulkDeleteDialog).toBe(true);
    alert.mockRestore();
  });
});
