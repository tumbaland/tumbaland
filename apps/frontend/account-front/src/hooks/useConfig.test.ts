import { renderHook } from '@testing-library/react';
import { useConfig } from './useConfig';

describe('useConfig', () => {
  // createConfigProvider's context default is `{}` (truthy), so the `if (!config) throw`
  // guard in useConfig can never actually fire — calling it outside a ConfigProvider just
  // returns the empty default instead of throwing.
  it('returns the empty default when used outside a ConfigProvider', () => {
    const { result } = renderHook(() => useConfig());
    expect(result.current).toEqual({});
  });
});
