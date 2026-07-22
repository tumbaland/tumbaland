import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from './usePersistedState';

beforeEach(() => {
  localStorage.clear();
});

it('starts from the default when nothing is persisted', () => {
  const { result } = renderHook(() => usePersistedState('key', 'default'));
  expect(result.current[0]).toBe('default');
});

it('reads a previously persisted value on mount', () => {
  localStorage.setItem('key', JSON.stringify('saved'));
  const { result } = renderHook(() => usePersistedState('key', 'default'));
  expect(result.current[0]).toBe('saved');
});

it('writes updates to localStorage', () => {
  const { result } = renderHook(() => usePersistedState('key', 'default'));
  act(() => result.current[1]('updated'));
  expect(result.current[0]).toBe('updated');
  expect(localStorage.getItem('key')).toBe(JSON.stringify('updated'));
});

it('supports a functional update', () => {
  const { result } = renderHook(() => usePersistedState('count', 1));
  act(() => result.current[1]((prev) => prev + 1));
  expect(result.current[0]).toBe(2);
  expect(localStorage.getItem('count')).toBe('2');
});

it('falls back to the default when the stored value is corrupt JSON', () => {
  localStorage.setItem('key', '{not json');
  const { result } = renderHook(() => usePersistedState('key', 'default'));
  expect(result.current[0]).toBe('default');
});
