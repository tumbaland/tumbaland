import { renderHook } from '@testing-library/react';
import React from 'react';
import { useConfig } from './useConfig';
import { ConfigContext } from '../config/ConfigProvider';

it('returns the config from context', () => {
  const config = { AUTH_SERVICE_URL: 'https://auth.example' } as any;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(ConfigContext.Provider, { value: config }, children);

  const { result } = renderHook(() => useConfig(), { wrapper });
  expect(result.current).toBe(config);
});

it('throws when used outside a ConfigProvider with a null context value', () => {
  // createConfigProvider's context default is a truthy `{}`, so this guard is unreachable
  // through normal app usage — it only fires if a consumer explicitly provides `null`.
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(ConfigContext.Provider, { value: null as any }, children);

  expect(() => renderHook(() => useConfig(), { wrapper })).toThrow(
    'useConfig must be used within a ConfigProvider'
  );
});
