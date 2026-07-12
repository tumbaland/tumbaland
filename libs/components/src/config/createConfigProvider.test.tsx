import { render, screen, waitFor } from '@testing-library/react';
import { createConfigProvider } from './createConfigProvider';

const { initMonitoringMock, initWebVitalsMock } = vi.hoisted(() => ({
  initMonitoringMock: vi.fn(),
  initWebVitalsMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tumbaland/frontend-core', () => ({
  initMonitoring: initMonitoringMock,
  initWebVitals: initWebVitalsMock
}));

interface TestConfig {
  PUBLIC_API_URL?: string;
  featureFlag?: boolean;
}

beforeEach(() => {
  initMonitoringMock.mockClear();
  initWebVitalsMock.mockClear();
  vi.restoreAllMocks();
});

describe('createConfigProvider (dev mode)', () => {
  const getDevConfig = () => ({ PUBLIC_API_URL: 'https://api.example', featureFlag: true }) satisfies TestConfig;

  it('loads the dev config synchronously and renders children', async () => {
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: true,
      mode: 'development',
      getDevConfig
    });

    render(
      <ConfigProvider>
        <div data-testid="child">loaded</div>
      </ConfigProvider>
    );

    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(initMonitoringMock).toHaveBeenCalledWith('development', {
      service: 'test-service',
      component: 'frontend',
      elkUrl: 'https://api.example/logs',
      captureConsoleLevels: undefined
    });
    expect(initWebVitalsMock).toHaveBeenCalledWith({ isDevelopment: true });
  });

  it('omits elkUrl when the dev config has no PUBLIC_API_URL', async () => {
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: true,
      mode: 'development',
      getDevConfig: () => ({})
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    await screen.findByTestId('child');
    expect(initMonitoringMock).toHaveBeenCalledWith('development', expect.objectContaining({ elkUrl: undefined }));
  });

  it('getGlobalConfig returns the fallback dev config (with a warning) before the provider mounts', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getGlobalConfig } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: true,
      mode: 'development',
      getDevConfig
    });

    const config = getGlobalConfig();

    expect(config).toEqual(getDevConfig());
    expect(warnSpy).toHaveBeenCalledWith('Using fallback configuration during HMR:', getDevConfig());
  });

  it('getGlobalConfig returns the real config once the provider has mounted', async () => {
    const { ConfigProvider, getGlobalConfig } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: true,
      mode: 'development',
      getDevConfig
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );
    await screen.findByTestId('child');

    expect(getGlobalConfig()).toEqual(getDevConfig());
  });
});

describe('createConfigProvider (production mode)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('shows the Loader before the config fetch resolves', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({})
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('fetches /config.json and renders children on success', async () => {
    const loadedConfig: TestConfig = { PUBLIC_API_URL: 'https://api.example' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => loadedConfig
    });
    const { ConfigProvider, getGlobalConfig } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({})
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/config.json');
    expect(initMonitoringMock).toHaveBeenCalledWith('production', {
      service: 'test-service',
      component: 'frontend',
      elkUrl: 'https://api.example/logs'
    });
    expect(initWebVitalsMock).toHaveBeenCalledWith({ isDevelopment: false });
    expect(getGlobalConfig()).toEqual(loadedConfig);
  });

  it('shows the ErrorPage when the config fetch responds not-ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({}) });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({})
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    expect(await screen.findByText('Configuration Error')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('shows the ErrorPage (with custom errorPageProps) when the fetch itself rejects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({}),
      errorPageProps: { title: 'Custom Load Failure' }
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    expect(await screen.findByText('Custom Load Failure')).toBeInTheDocument();
  });

  it('getGlobalConfig throws before the provider has loaded a config', () => {
    const { getGlobalConfig } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({})
    });

    expect(() => getGlobalConfig()).toThrow('Configuration not initialized. Make sure ConfigProvider is mounted.');
  });

  it('renders without crashing when themed is true', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
    const { ConfigProvider } = createConfigProvider<TestConfig>({
      serviceName: 'test-service',
      isDev: false,
      mode: 'production',
      getDevConfig: () => ({}),
      themed: true
    });

    render(
      <ConfigProvider>
        <div data-testid="child" />
      </ConfigProvider>
    );

    await waitFor(() => expect(screen.getByTestId('child')).toBeInTheDocument());
  });
});
