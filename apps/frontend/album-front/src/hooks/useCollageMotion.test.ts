import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { MOTION_INTERVAL_MS, MovingItem, useMotionReport, useRemoteMotion } from './useCollageMotion';

vi.mock('../services/collageService', () => ({
  collageService: { reportMoving: vi.fn() }
}));

import { collageService } from '../services/collageService';

const reportMoving = collageService.reportMoving as unknown as ReturnType<typeof vi.fn>;
const at = (x: number): MovingItem => ({ id: 'a', x, y: 0, width: 10, height: 10, rotation: 0 });

beforeEach(() => {
  vi.useFakeTimers();
  reportMoving.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

type ReportProps = { active: boolean; item: MovingItem | null; enabled?: boolean };

const setupReport = (initial: ReportProps) =>
  renderHook(
    ({ active, item, enabled = true }: ReportProps) =>
      useMotionReport({ collageId: 'c1', session: 'tab-1', enabled, active, item }),
    { initialProps: initial }
  );

describe('useMotionReport', () => {
  it('reports at most ten times a second while dragging, always ending on the last position', () => {
    const { rerender } = setupReport({ active: true, item: at(0) });
    for (let x = 1; x <= 5; x += 1) rerender({ active: true, item: at(x) });

    expect(reportMoving).toHaveBeenCalledTimes(1);
    void act(() => vi.advanceTimersByTime(MOTION_INTERVAL_MS));

    expect(reportMoving).toHaveBeenCalledTimes(2);
    expect(reportMoving).toHaveBeenLastCalledWith('c1', 'tab-1', at(5));
  });

  it('says so when the item is let go', () => {
    const { rerender } = setupReport({ active: true, item: at(0) });

    rerender({ active: false, item: at(3) });

    expect(reportMoving).toHaveBeenLastCalledWith('c1', 'tab-1', null);
  });

  it('sends nothing with no live connection, or when nothing is moving', () => {
    const { rerender } = setupReport({ active: true, item: at(0), enabled: false });
    rerender({ active: false, item: at(0), enabled: false });
    setupReport({ active: false, item: at(0) });

    expect(reportMoving).not.toHaveBeenCalled();
  });
});

describe('useRemoteMotion', () => {
  const irja = (item: MovingItem | null) => ({ userId: 'u-irja', name: 'Irja', item });

  it('follows where someone has the item they are moving', () => {
    const { result } = renderHook(() => useRemoteMotion());

    act(() => result.current.onMoving(irja(at(40))));

    expect(result.current.motions).toEqual([
      expect.objectContaining({ userId: 'u-irja', item: at(40), released: false })
    ]);
  });

  it('keeps a let-go item where it was left until their save arrives', () => {
    const { result } = renderHook(() => useRemoteMotion());
    act(() => result.current.onMoving(irja(at(40))));

    act(() => result.current.onMoving(irja(null)));
    expect(result.current.motions[0]).toMatchObject({ item: at(40), released: true });

    act(() => result.current.settle('u-irja'));
    expect(result.current.motions).toEqual([]);
  });

  it('lets go of a drag whose save never comes', () => {
    const { result } = renderHook(() => useRemoteMotion());
    act(() => result.current.onMoving(irja(at(40))));
    act(() => result.current.onMoving(irja(null)));

    void act(() => vi.advanceTimersByTime(3000));

    expect(result.current.motions).toEqual([]);
  });

  it('lets go of a drag that went silent, as when their tab closed mid-drag', () => {
    const { result } = renderHook(() => useRemoteMotion());
    act(() => result.current.onMoving(irja(at(40))));

    void act(() => vi.advanceTimersByTime(2000));
    expect(result.current.motions).toHaveLength(1);
    void act(() => vi.advanceTimersByTime(3000));
    expect(result.current.motions).toEqual([]);
  });
});
