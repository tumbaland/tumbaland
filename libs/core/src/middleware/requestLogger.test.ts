jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import logger from '../logging/logger';
import { requestLogger, requestLoggerWithMetrics, simpleRequestLogger } from './requestLogger';

function mockReqRes() {
  const req: any = {
    method: 'GET',
    url: '/albums/123',
    correlationId: 'corr-1',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('test-agent')
  };
  const res: any = { statusCode: 200, on: jest.fn() };
  return { req, res };
}

describe('simpleRequestLogger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs an inbound request line with correlation id, ip, and user agent', () => {
    const { req, res } = mockReqRes();
    const next = jest.fn();

    simpleRequestLogger(req, res, next);

    expect(logger.info).toHaveBeenCalledWith('→ GET /albums/123', {
      correlationId: 'corr-1',
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to "unknown" correlation id when none was set on the request', () => {
    const { req, res } = mockReqRes();
    delete req.correlationId;
    const next = jest.fn();

    simpleRequestLogger(req, res, next);

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ correlationId: 'unknown' })
    );
  });

  it('logs the outbound response line with status and duration once the response finishes', () => {
    const { req, res } = mockReqRes();
    const next = jest.fn();

    simpleRequestLogger(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    const finishHandler = res.on.mock.calls.find((c: any[]) => c[0] === 'finish')[1];
    res.statusCode = 200;
    finishHandler();

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/^← GET \/albums\/123 200 \d+ms$/),
      expect.objectContaining({ correlationId: 'corr-1', statusCode: 200 })
    );
  });
});

describe('requestLogger', () => {
  it('is a Morgan middleware function', () => {
    expect(typeof requestLogger).toBe('function');
  });
});

describe('requestLoggerWithMetrics', () => {
  it('bundles requestLogger and metricsMiddleware as a two-item array', () => {
    expect(requestLoggerWithMetrics).toHaveLength(2);
    expect(requestLoggerWithMetrics[0]).toBe(requestLogger);
    expect(typeof requestLoggerWithMetrics[1]).toBe('function');
  });
});
