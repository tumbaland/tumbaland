import { act, renderHook } from '@testing-library/react';
import { vi } from 'vite-plus/test';
import { useInView } from './useInView';

type Callback = (records: Array<{ isIntersecting: boolean }>) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(
    public callback: Callback,
    public options?: { threshold?: number }
  ) {
    FakeObserver.instances.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeObserver.instances = [];
});

it('is true from the start where there is nothing to watch with', () => {
  vi.stubGlobal('IntersectionObserver', undefined);

  const { result } = renderHook(() => useInView());

  expect(result.current[1]).toBe(true);
});

describe('with an observer', () => {
  beforeEach(() => vi.stubGlobal('IntersectionObserver', FakeObserver));

  it('waits for the element to be on screen, then stays true and stops watching', () => {
    const { result } = renderHook(() => useInView(0.5));
    expect(result.current[1]).toBe(false);

    act(() => result.current[0](document.createElement('div')));
    const observer = FakeObserver.instances[0]!;
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.options).toEqual({ threshold: 0.5 });

    act(() => observer.callback([{ isIntersecting: false }]));
    expect(result.current[1]).toBe(false);

    act(() => observer.callback([{ isIntersecting: true }]));
    expect(result.current[1]).toBe(true);
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('does not watch before it has an element, and lets go on unmount', () => {
    const { result, unmount } = renderHook(() => useInView());
    expect(FakeObserver.instances).toHaveLength(0);

    act(() => result.current[0](document.createElement('div')));
    const observer = FakeObserver.instances[0]!;
    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
