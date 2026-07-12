import fs from 'fs';

/**
 * logger.ts builds its transport list at module-load time based on
 * NODE_ENV/LOG_TO_FILE, so each scenario needs a fresh module load via
 * isolateModulesAsync rather than a single shared import.
 */
async function loadLogger(env: Record<string, string | undefined>) {
  const ORIGINAL_ENV = process.env;
  process.env = { ...ORIGINAL_ENV, ...env };

  let loggerModule!: typeof import('./logger').default;
  await jest.isolateModulesAsync(async () => {
    loggerModule = (await import('./logger')).default;
  });

  process.env = ORIGINAL_ENV;
  return loggerModule;
}

// winston's `.transports` also holds the wrapped exception/rejection-handler
// transports (always present), so assert on named regular transports only.
function namedTransports(logger: import('winston').Logger, name: string) {
  return logger.transports.filter((t) => (t as unknown as { name?: string }).name === name);
}

describe('logger', () => {
  it('logs at debug level in development', async () => {
    const logger = await loadLogger({ NODE_ENV: 'development', LOG_TO_FILE: undefined });
    expect(logger.level).toBe('debug');
  });

  it('logs at info level in production', async () => {
    const logger = await loadLogger({ NODE_ENV: 'production' });
    expect(logger.level).toBe('info');
  });

  it('defaults to development (debug level) when NODE_ENV is unset', async () => {
    const ORIGINAL_ENV = process.env;
    const merged: Record<string, string | undefined> = { ...ORIGINAL_ENV };
    delete merged.NODE_ENV;
    process.env = merged as NodeJS.ProcessEnv;

    let loggerModule!: typeof import('./logger').default;
    await jest.isolateModulesAsync(async () => {
      loggerModule = (await import('./logger')).default;
    });

    process.env = ORIGINAL_ENV;
    expect(loggerModule.level).toBe('debug');
  });

  it('does not create a file transport when LOG_TO_FILE is unset', async () => {
    const logger = await loadLogger({ NODE_ENV: 'development', LOG_TO_FILE: undefined });
    expect(namedTransports(logger, 'file')).toHaveLength(0);
    expect(namedTransports(logger, 'console')).toHaveLength(1);
  });

  it('does not create a file transport in production, even if LOG_TO_FILE is true', async () => {
    const logger = await loadLogger({ NODE_ENV: 'production', LOG_TO_FILE: 'true' });
    expect(namedTransports(logger, 'file')).toHaveLength(0);
  });

  describe('with LOG_TO_FILE=true in development', () => {
    it('creates the logs directory when it does not exist and adds a file transport', async () => {
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

      const logger = await loadLogger({ NODE_ENV: 'development', LOG_TO_FILE: 'true' });

      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('logs'), { recursive: true });
      expect(namedTransports(logger, 'file')).toHaveLength(1);

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
    });

    it('does not recreate the logs directory when it already exists', async () => {
      const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

      const logger = await loadLogger({ NODE_ENV: 'development', LOG_TO_FILE: 'true' });

      expect(mkdirSpy).not.toHaveBeenCalled();
      expect(namedTransports(logger, 'file')).toHaveLength(1);

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
    });
  });
});
