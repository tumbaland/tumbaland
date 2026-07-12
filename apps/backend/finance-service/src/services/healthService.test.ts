import mongoose from 'mongoose';
import { checkHealth, getHealthStatusCode } from './healthService';

describe('checkHealth', () => {
  it('reports ok/connected when Mongo readyState is 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 1 } as any);
    const health = await checkHealth();
    expect(health).toMatchObject({ status: 'ok', dependencies: { mongodb: 'connected' } });
  });

  it('reports error/disconnected when Mongo readyState is not 1', async () => {
    jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ readyState: 0 } as any);
    const health = await checkHealth();
    expect(health).toMatchObject({ status: 'error', dependencies: { mongodb: 'disconnected' } });
  });
});

describe('getHealthStatusCode', () => {
  it('returns 200 for ok, 503 for error', () => {
    expect(getHealthStatusCode({ status: 'ok' } as any)).toBe(200);
    expect(getHealthStatusCode({ status: 'error' } as any)).toBe(503);
  });
});
