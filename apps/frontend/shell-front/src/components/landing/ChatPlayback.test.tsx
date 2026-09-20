import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import ChatPlayback from './ChatPlayback';

/**
 * The playback is a pure function of one clock, so the test drives that clock
 * rather than waiting on real frames: stub `requestAnimationFrame` and
 * `performance.now`, and a whole conversation takes no time at all.
 */

let now = 0;
let frames: FrameRequestCallback[] = [];
/** The observer callbacks currently watching something. */
let watching: IntersectionObserverCallback[] = [];

/** Runs every pending frame at `now + ms`, the way a browser would. */
const advance = async (ms: number) => {
  now += ms;
  await act(async () => {
    frames.splice(0).forEach((frame) => frame(now));
  });
};

/** The phone has come into view. */
const scrollIntoView = async () => {
  await act(async () => {
    watching.forEach((callback) =>
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    );
  });
};

beforeEach(() => {
  now = 0;
  frames = [];
  watching = [];

  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        watching.push(callback);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('waits for the phone to be on screen before it starts', async () => {
  render(<ChatPlayback />);

  // The reply is not there yet rather than there and invisible: a visitor who
  // lands on the page has not already missed the thing it is here to show.
  expect(screen.queryByText(/Logged for Friday 4 September/)).not.toBeInTheDocument();

  await scrollIntoView();
  expect(screen.queryByText(/Logged for Friday 4 September/)).not.toBeInTheDocument();
});

it('plays the exchange through to the end, then offers it again', async () => {
  render(<ChatPlayback />);
  await scrollIntoView();

  // Far past the end of the conversation, which is where the clock stops.
  await advance(60000);

  expect(screen.getByText(/we went to Sushi House on Friday/)).toBeInTheDocument();
  expect(screen.getByText(/Logged for Friday 4 September/)).toBeInTheDocument();
  expect(screen.getByText(/Nine photos from Nice/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Watch again/ })).toBeInTheDocument();
});

it('runs the tools first, then types the reply out', async () => {
  render(<ChatPlayback />);
  await scrollIntoView();

  // The message has gone and the connector is working on it: the tools are up
  // and no reply has started.
  await advance(1800);
  expect(screen.getByText('log_day')).toBeInTheDocument();
  expect(screen.queryByText(/^Logged for/)).not.toBeInTheDocument();

  // Part way through the answer.
  await advance(1100);

  const partial = screen.getByText(/^Logged for/);
  expect(partial).toBeInTheDocument();
  expect(partial.textContent).not.toBe('Logged for Friday 4 September. Dining at Sushi House, and Movies.');

  await advance(60000);
  expect(screen.getByText('Logged for Friday 4 September. Dining at Sushi House, and Movies.')).toBeInTheDocument();
});

it('shows the whole conversation at once to anyone who asked for less motion', () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;

  render(<ChatPlayback />);

  expect(screen.getByText(/Nine photos from Nice/)).toBeInTheDocument();
  // Nothing played, so there is nothing to play again.
  expect(screen.queryByRole('button', { name: /Watch again/ })).not.toBeInTheDocument();
});
