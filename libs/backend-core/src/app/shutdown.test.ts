jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

jest.mock('../database/connection', () => ({
  __esModule: true,
  disconnectDB: jest.fn().mockResolvedValue(undefined)
}));

import type { Server } from 'http';
import logger from '../logging/logger';
import { disconnectDB } from '../database/connection';
import { registerShutdown } from './shutdown';

/** Minimal fake http.Server whose close() invokes its callback. */
function fakeServer(closeErr?: Error): Server {
  return {
    close: jest.fn((cb?: (err?: Error) => void) => {
      cb?.(closeErr);
      return undefined as unknown as Server;
    })
  } as unknown as Server;
}

describe('registerShutdown', () => {
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  let processOnSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(listeners)) delete listeners[key];

    processOnSpy = jest
      .spyOn(process, 'on')
      .mockImplementation((event: string | symbol, handler: (...args: unknown[]) => void) => {
        listeners[event as string] = handler;
        return process;
      });
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((): never => undefined as never));
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    exitSpy.mockRestore();
  });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('registers SIGINT and SIGTERM handlers', () => {
    registerShutdown({ serviceName: 'svc' });
    expect(Object.keys(listeners).sort()).toEqual(['SIGINT', 'SIGTERM']);
  });

  it('closes the server, disconnects the DB, and exits 0 on SIGTERM', async () => {
    const server = fakeServer();
    registerShutdown({ serviceName: 'svc', server });

    listeners.SIGTERM();
    await flush();

    expect(server.close).toHaveBeenCalled();
    expect(disconnectDB).toHaveBeenCalledWith('svc');
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith('Received shutdown signal, closing gracefully', {
      service: 'svc',
      signal: 'SIGTERM'
    });
  });

  it('runs the onShutdown hook before closing the server', async () => {
    const order: string[] = [];
    const server = {
      close: jest.fn((cb?: (err?: Error) => void) => {
        order.push('server');
        cb?.();
        return undefined as unknown as Server;
      })
    } as unknown as Server;
    const onShutdown = jest.fn(async () => {
      order.push('hook');
    });

    registerShutdown({ serviceName: 'svc', server, onShutdown });
    listeners.SIGINT();
    await flush();

    expect(order).toEqual(['hook', 'server']);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('skips the DB disconnect when disconnectDatabase is false', async () => {
    registerShutdown({ serviceName: 'svc', disconnectDatabase: false });

    listeners.SIGTERM();
    await flush();

    expect(disconnectDB).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('is idempotent — a second signal while shutting down is ignored', async () => {
    const server = fakeServer();
    registerShutdown({ serviceName: 'svc', server });

    listeners.SIGTERM();
    listeners.SIGINT();
    await flush();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when the server fails to close', async () => {
    const server = fakeServer(new Error('close boom'));
    registerShutdown({ serviceName: 'svc', server });

    listeners.SIGTERM();
    await flush();

    expect(disconnectDB).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('Error during graceful shutdown', {
      service: 'svc',
      error: 'close boom'
    });
  });
});
