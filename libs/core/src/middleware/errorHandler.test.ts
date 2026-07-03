import express from 'express';
import request from 'supertest';
import { errorHandler } from './errorHandler';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';

function buildApp() {
  const app = express();
  app.get('/boom', (_req, _res, next) => next(new Error('kaboom')));
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    (logger.error as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('logs the error and responds 500 with a generic message in production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong'
    });
    expect(logger.error).toHaveBeenCalledWith('Unhandled error:', expect.objectContaining({ error: 'kaboom' }));
  });

  it('includes the real error message and stack in development', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildApp();

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('kaboom');
    expect(res.body.stack).toBeDefined();
  });

  it('adds CORS headers to the error response for an allowed origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();

    const res = await request(app).get('/boom').set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not add CORS headers for a disallowed origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();

    const res = await request(app).get('/boom').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
