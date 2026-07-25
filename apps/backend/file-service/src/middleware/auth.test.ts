import { Request, Response } from 'express';
import { requireApiKey, requireSignedToken } from './auth';
import { signToken } from '../utils/hmac';

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, FILE_SERVICE_API_KEY: 'test-api-key', FILE_SERVICE_HMAC_SECRET: 'test-hmac-secret' };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('requireApiKey', () => {
  it('calls next when the header matches FILE_SERVICE_API_KEY', () => {
    const req = { headers: { 'x-internal-api-key': 'test-api-key' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the header is missing', () => {
    const req = { headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the header does not match', () => {
    const req = { headers: { 'x-internal-api-key': 'wrong-key' } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireSignedToken', () => {
  function reqWith(query: Record<string, string>, fileId = 'a/b/c.jpg') {
    return { query, params: { fileId } } as unknown as Request;
  }

  it('calls next for a valid, unexpired token', () => {
    const expiresMs = Date.now() + 60_000;
    const token = signToken('download', 'a/b/c.jpg', expiresMs);
    const req = reqWith({ token, expires: String(expiresMs) });
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects with 401 when token or expires is missing', () => {
    const req = reqWith({});
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Missing token or expires' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 400 when expires is not a valid number', () => {
    const req = reqWith({ token: 'abc', expires: 'not-a-number' });
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid expires value' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects with 403 for an expired token', () => {
    const expiresMs = Date.now() - 1;
    const token = signToken('download', 'a/b/c.jpg', expiresMs);
    const req = reqWith({ token, expires: String(expiresMs) });
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
  });

  it('rejects with 403 for a token signed for a different operation (upload token used for download)', () => {
    const expiresMs = Date.now() + 60_000;
    const token = signToken('upload', 'a/b/c.jpg', expiresMs);
    const req = reqWith({ token, expires: String(expiresMs) });
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects with 403 (not 500) when the token is malformed', () => {
    const expiresMs = Date.now() + 60_000;
    const req = reqWith({ token: 'not-a-real-token', expires: String(expiresMs) });
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('joins a multi-segment fileId (splat param) with "/" before verifying', () => {
    const expiresMs = Date.now() + 60_000;
    const token = signToken('download', 'a/b/c.jpg', expiresMs);
    const req = { query: { token, expires: String(expiresMs) }, params: { fileId: ['a', 'b', 'c.jpg'] } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    requireSignedToken('download')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
