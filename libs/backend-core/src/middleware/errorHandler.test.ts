import express from 'express';
import request from 'supertest';
import { errorHandler } from './errorHandler';
import { NotFoundError, ForbiddenError, PaymentRequiredError } from '../errors/HttpError';

jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function buildApp() {
  const app = express();
  app.get('/boom', (_req, _res, next) => next(new Error('kaboom')));
  app.get('/missing', (_req, _res, next) => next(new NotFoundError('Album not found')));
  app.get('/forbidden', (_req, _res, next) => next(new ForbiddenError()));
  app.get('/validation', (_req, _res, next) =>
    next(namedError('ValidationError', 'CollageModel validation failed: title: Path `title` is required.'))
  );
  app.get('/cast', (_req, _res, next) => next(namedError('CastError', 'Cast to ObjectId failed for value "abc"')));
  app.get('/over-quota', (_req, _res, next) =>
    next(
      new PaymentRequiredError('Storage limit reached', {
        code: 'QUOTA_EXCEEDED',
        meter: 'storageBytes',
        used: 1073741824,
        limit: 1073741824,
        planCode: 'free',
        upgradeTo: 'personal'
      })
    )
  );
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    (logger.error as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();
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

  describe('typed HttpError instances', () => {
    it('uses the error’s own status code and message, in production too', async () => {
      process.env.NODE_ENV = 'production';
      const app = buildApp();

      const res = await request(app).get('/missing');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: 'NotFoundError', message: 'Album not found' });
    });

    it('logs at warn level, not error, and without a stack trace', async () => {
      const app = buildApp();

      await request(app).get('/forbidden');

      expect(logger.warn).toHaveBeenCalledWith(
        'Request failed:',
        expect.objectContaining({ error: 'Access denied', statusCode: 403 })
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('does not include a stack trace in the response body, even in development', async () => {
      process.env.NODE_ENV = 'development';
      const app = buildApp();

      const res = await request(app).get('/missing');

      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Mongoose ValidationError / CastError', () => {
    it('maps a ValidationError to 400, using its own message', async () => {
      const app = buildApp();

      const res = await request(app).get('/validation');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: 'ValidationError',
        message: 'CollageModel validation failed: title: Path `title` is required.'
      });
    });

    it('maps a CastError (e.g. an invalid ObjectId) to 400', async () => {
      const app = buildApp();

      const res = await request(app).get('/cast');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CastError');
    });
  });

  describe('PaymentRequiredError', () => {
    it('serializes the details the upgrade dialog needs alongside the envelope', async () => {
      const app = buildApp();

      const res = await request(app).get('/over-quota');

      expect(res.status).toBe(402);
      expect(res.body).toEqual({
        success: false,
        error: 'PaymentRequiredError',
        message: 'Storage limit reached',
        code: 'QUOTA_EXCEEDED',
        meter: 'storageBytes',
        used: 1073741824,
        limit: 1073741824,
        planCode: 'free',
        upgradeTo: 'personal'
      });
    });

    it('logs a paywall hit as routine control flow, not as a server fault', async () => {
      const app = buildApp();

      await request(app).get('/over-quota');

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Request failed:', expect.objectContaining({ statusCode: 402 }));
    });
  });
});
