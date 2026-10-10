import { act, renderHook } from '@testing-library/react';
import { vi } from 'vite-plus/test';
import { RECENT_NOTES } from '../config/releaseNotes';
import { useWhatsNew } from './useWhatsNew';

const KEY = 'tumbaland.whatsNew.seen';
const IDS = RECENT_NOTES.map((note) => note.id);

beforeEach(() => localStorage.clear());

it('starts a device that has never recorded anything with every note seen, so it shows no dot', () => {
  const { result } = renderHook(() => useWhatsNew());

  expect(result.current.unseen).toBe(false);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(IDS);
});

it('is unseen when a note exists that this device has not looked at', () => {
  localStorage.setItem(KEY, JSON.stringify(IDS.slice(1)));

  const { result } = renderHook(() => useWhatsNew());

  expect(result.current.unseen).toBe(true);
});

it('is unseen for a note older than one already seen: it goes by note, not by date', () => {
  // The newest note is the only one seen. The others carry older dates, which
  // a "newest date seen" rule would have called seen too.
  localStorage.setItem(KEY, JSON.stringify([IDS[0]]));

  expect(renderHook(() => useWhatsNew()).result.current.unseen).toBe(true);
});

it('clears once the notes have been opened, and stays cleared on the next visit', () => {
  localStorage.setItem(KEY, JSON.stringify([]));
  const { result, unmount } = renderHook(() => useWhatsNew());
  expect(result.current.unseen).toBe(true);

  act(() => result.current.markSeen());

  expect(result.current.unseen).toBe(false);
  unmount();
  expect(renderHook(() => useWhatsNew()).result.current.unseen).toBe(false);
});

it('treats a value it does not recognise as never recorded, rather than nagging', () => {
  // What an earlier build kept here: a single date.
  localStorage.setItem(KEY, '2026-10-03');

  const { result } = renderHook(() => useWhatsNew());

  expect(result.current.unseen).toBe(false);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(IDS);
});

it('shows no dot where storage cannot be read or written', () => {
  const get = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  try {
    const { result } = renderHook(() => useWhatsNew());
    expect(result.current.unseen).toBe(false);
  } finally {
    get.mockRestore();
    set.mockRestore();
  }
});
