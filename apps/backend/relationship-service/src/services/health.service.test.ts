import mongoose from 'mongoose';
import { checkHealth, getHealthStatusCode } from './health.service';

describe('checkHealth', () => {
  const originalReadyState = mongoose.connection.readyState;

  afterEach(() => {
    jest.restoreAllMocks();
    (mongoose.connection as any).readyState = originalReadyState;
  });

  it('reports ok when mongoose is connected', () => {
    (mongoose.connection as any).readyState = 1;

    const health = checkHealth();

    expect(health.status).toBe('ok');
    expect(health.dependencies.mongodb).toBe('connected');
    expect(health.service).toBe('relationship-service');
  });

  it('reports error when mongoose is not connected', () => {
    (mongoose.connection as any).readyState = 0;

    const health = checkHealth();

    expect(health.status).toBe('error');
    expect(health.dependencies.mongodb).toBe('disconnected');
  });

  it('reports error with unknown mongodb status if reading connection state throws', () => {
    jest.spyOn(mongoose, 'connection', 'get').mockImplementation(() => {
      throw new Error('boom');
    });

    const health = checkHealth();

    expect(health.status).toBe('error');
    expect(health.dependencies.mongodb).toBe('unknown');
  });
});

describe('getHealthStatusCode', () => {
  it('returns 200 for ok status', () => {
    expect(getHealthStatusCode({ status: 'ok' } as any)).toBe(200);
  });

  it('returns 503 for error status', () => {
    expect(getHealthStatusCode({ status: 'error' } as any)).toBe(503);
  });
});
