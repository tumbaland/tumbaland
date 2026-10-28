import { MemoryRouter, useLocation } from 'react-router';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useConsumedParam } from './useConsumedParam';

const wrapperAt = (url: string) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return Wrapper;
};

const render = (url: string, handle: (value: string) => boolean | void) =>
  renderHook(
    () => {
      useConsumedParam('date', handle);
      return useLocation().search;
    },
    { wrapper: wrapperAt(url) }
  );

it('hands the value over and takes the parameter out of the address', () => {
  const handle = vi.fn();
  const { result } = render('/journal?date=2026-10-13&view=calendar', handle);

  expect(handle).toHaveBeenCalledTimes(1);
  expect(handle).toHaveBeenCalledWith('2026-10-13');
  expect(result.current).toBe('?view=calendar');
});

it('leaves the parameter alone when the handler says it was no use', () => {
  const { result } = render('/journal?date=nonsense', () => false);

  expect(result.current).toBe('?date=nonsense');
});

it('does nothing when the parameter is absent', () => {
  const handle = vi.fn();
  render('/journal', handle);

  expect(handle).not.toHaveBeenCalled();
});
