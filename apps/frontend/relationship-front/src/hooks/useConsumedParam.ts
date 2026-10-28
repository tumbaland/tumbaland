import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Acts once on a link's query parameter, then removes it from the address.
 *
 * `handle` gets the value and returns `false` to say it was not usable, in
 * which case the parameter is left as it was. Removing it is what stops a later
 * close or re-render from opening the same thing again. The latest `handle` is
 * called, but only a change of the parameter itself triggers it.
 */
export const useConsumedParam = (name: string, handle: (value: string) => boolean | void) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name);

  const latest = useRef(handle);
  useEffect(() => {
    latest.current = handle;
  });

  useEffect(() => {
    if (!value) return;
    if (latest.current(value) === false) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(name);
        return next;
      },
      { replace: true }
    );
  }, [value, name, setSearchParams]);
};
