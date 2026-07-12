import mongoose from 'mongoose';
import healthService from './healthService';

describe('checkHealth', () => {
  it('reports ok/connected when Mongo readyState is 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as any);

    const health = await healthService.checkHealth();

    expect(health).toMatchObject({ status: 'ok', service: 'album-service', dependencies: { mongodb: 'connected' } });
  });

  it('reports error/disconnected when Mongo readyState is not 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as any);

    const health = await healthService.checkHealth();

    expect(health).toMatchObject({ status: 'error', dependencies: { mongodb: 'disconnected' } });
  });
});

describe('getHealthStatusCode', () => {
  it('returns 200 for status ok', () => {
    expect(healthService.getHealthStatusCode({ status: 'ok' })).toBe(200);
  });

  it('returns 503 for status error', () => {
    expect(healthService.getHealthStatusCode({ status: 'error' })).toBe(503);
  });
});
