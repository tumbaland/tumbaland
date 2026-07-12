import { renderHook } from '@testing-library/react';
import { useConfig } from './useConfig';

describe('useConfig', () => {
  // createConfigProvider's ConfigContext defaults to `{}` (an empty object,
  // which is truthy), and the Provider only ever supplies the context after
  // its own `config` state is already truthy — so `if (!config) throw` in
  // useConfig can never actually run; useContext always resolves to a real
  // (if possibly empty) object. Documenting the real behavior rather than
  // faking a throw that can't happen through the real Provider.
  it('returns the default empty config object when used outside a ConfigProvider (does not throw)', () => {
    const { result } = renderHook(() => useConfig());
    expect(result.current).toEqual({});
  });
});
