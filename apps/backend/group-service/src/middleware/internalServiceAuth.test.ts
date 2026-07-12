import { Response } from 'express';
import { validateInternalServiceToken, allowUserOrInternalService, InternalServiceRequest } from './internalServiceAuth';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, INTERNAL_SERVICE_TOKEN: 'test-internal-token' };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('validateInternalServiceToken', () => {
  it('calls next without marking the request internal when no token header is present', () => {
    const req = { headers: {} } as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    validateInternalServiceToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.isInternalService).toBeUndefined();
  });

  it('responds 500 when INTERNAL_SERVICE_TOKEN is not configured', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    const req = { headers: { 'x-internal-token': 'anything' } } as unknown as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    validateInternalServiceToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the token does not match', () => {
    const req = { headers: { 'x-internal-token': 'wrong' } } as unknown as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    validateInternalServiceToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('marks the request as an internal service and calls next on a matching token', () => {
    const req = {
      headers: { 'x-internal-token': 'test-internal-token', 'x-service-id': 'album-service' }
    } as unknown as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    validateInternalServiceToken(req, res, next);

    expect(req.isInternalService).toBe(true);
    expect(req.serviceIdentifier).toBe('album-service');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('defaults serviceIdentifier to "unknown" when x-service-id is absent', () => {
    const req = { headers: { 'x-internal-token': 'test-internal-token' } } as unknown as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    validateInternalServiceToken(req, res, next);

    expect(req.serviceIdentifier).toBe('unknown');
  });
});

describe('allowUserOrInternalService', () => {
  it('allows an internal service request through', () => {
    const req = { isInternalService: true } as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    allowUserOrInternalService(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows an authenticated user through', () => {
    const req = { user: { id: 'u1' } } as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    allowUserOrInternalService(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects with 401 when neither internal service nor authenticated user', () => {
    const req = {} as InternalServiceRequest;
    const res = mockRes();
    const next = jest.fn();

    allowUserOrInternalService(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
