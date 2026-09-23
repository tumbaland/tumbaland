import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ScreenEffect } from './ScreenEffect';

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => vi.useRealTimers());

describe('ScreenEffect', () => {
  it('fills the thread, then says it is done', () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    const onDone = vi.fn();

    render(<ScreenEffect effect="hearts" onDone={onDone} />);

    expect(screen.getByTestId('screen-effect-hearts')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(6000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows nothing to someone who asked for less motion', () => {
    setReducedMotion(true);
    const onDone = vi.fn();

    render(<ScreenEffect effect="confetti" onDone={onDone} />);

    expect(screen.queryByTestId('screen-effect-confetti')).not.toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
  });
});
