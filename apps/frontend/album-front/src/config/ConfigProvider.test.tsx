import { vi } from 'vitest';

const { createConfigProviderMock } = vi.hoisted(() => ({
  createConfigProviderMock: vi.fn().mockReturnValue({
    ConfigContext: 'context-stub',
    ConfigProvider: 'provider-stub',
    getGlobalConfig: 'getGlobalConfig-stub',
    useConfig: 'useConfig-stub'
  })
}));

vi.mock('@tumbaland/components', () => ({
  createConfigProvider: createConfigProviderMock
}));

it('builds the config provider with the album-front service name and dev/mode flags', async () => {
  await import('./ConfigProvider');

  expect(createConfigProviderMock).toHaveBeenCalledWith(
    expect.objectContaining({
      serviceName: 'album-front',
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE
    })
  );
});

it('maps every VITE_* env var into the dev config', async () => {
  await import('./ConfigProvider');

  const { getDevConfig } = createConfigProviderMock.mock.calls[0][0];
  expect(getDevConfig()).toEqual({
    ALBUM_API_URL: import.meta.env.VITE_ALBUM_API_URL,
    AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL,
    AUTH_FRONT_URL: import.meta.env.VITE_AUTH_FRONT_URL,
    GROUP_API_URL: import.meta.env.VITE_GROUP_API_URL,
    ALBUM_FRONT_URL: import.meta.env.VITE_ALBUM_FRONT_URL,
    ACCOUNT_FRONT_URL: import.meta.env.VITE_ACCOUNT_FRONT_URL,
    SHELL_FRONT_URL: import.meta.env.VITE_SHELL_FRONT_URL,
    PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL
  });
});

it('re-exports the factory outputs', async () => {
  const mod = await import('./ConfigProvider');

  expect(mod.ConfigContext).toBe('context-stub');
  expect(mod.ConfigProvider).toBe('provider-stub');
  expect(mod.getGlobalConfig).toBe('getGlobalConfig-stub');
  expect(mod.useConfig).toBe('useConfig-stub');
});
