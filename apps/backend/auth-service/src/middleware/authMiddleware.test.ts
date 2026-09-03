import { Request, Response } from 'express';

jest.mock('../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}));

import { User } from '../models/User';
import { authenticateToken, optionalAuth, requireRole, requireApproved } from './authMiddleware';
import { generateJWT } from '../services/jwtService';

const mockedFindOne = User.findOne as unknown as jest.Mock;
const mockedFindOneAndUpdate = User.findOneAndUpdate as unknown as jest.Mock;

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    headers: {},
    ...overrides
  } as unknown as Request;
}

describe('authMiddleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('rejects requests with no token', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an invalid/malformed token', async () => {
      const req = mockReq({ cookies: { access_token: 'not-a-real-jwt' } } as any);
      const res = mockRes();
      const next = jest.fn();

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
      expect(mockedFindOne).not.toHaveBeenCalled();
    });

    it('rejects a valid token when the DB user no longer exists', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOne.mockResolvedValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not found' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a valid token whose tokenVersion is stale (post-invalidation)', async () => {
      // Simulates: token was issued when tokenVersion was 1, but
      // invalidate-tokens has since bumped the DB user's tokenVersion to 2.
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 2, isApproved: true });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Token has been invalidated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts a valid token whose tokenVersion matches the DB user and attaches req.user/req.dbUser', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const res = mockRes();
      const next = jest.fn();
      const dbUser = { email: 'user@example.com', tokenVersion: 1, isApproved: true };
      mockedFindOne.mockResolvedValue(dbUser);

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toMatchObject({ email: 'user@example.com', tokenVersion: 1 });
      expect((req as any).dbUser).toBe(dbUser);
    });

    it('copies the token’s groups onto req.userGroups', async () => {
      // Handlers read membership off `req.userGroups`, the contract
      // backend-core's middleware sets. Leaving it unset here made every caller
      // look like they belonged to no groups, so pinning an API key to a group
      // was refused with "You are not a member of that group".
      const token = generateJWT({
        id: '1',
        email: 'user@example.com',
        name: 'User',
        groups: ['g1', 'g2']
      });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const next = jest.fn();
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', isApproved: true });

      await authenticateToken(req, mockRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.userGroups).toEqual(['g1', 'g2']);
    });

    it('sets req.userGroups to an empty array when the token carries no groups', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User' });
      const req = mockReq({ cookies: { access_token: token } } as any);
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', isApproved: true });

      await authenticateToken(req, mockRes(), jest.fn());

      // Never undefined: a handler doing `req.userGroups.includes(...)` must not
      // throw for a user who happens to be in no groups.
      expect(req.userGroups).toEqual([]);
    });

    it('accepts a token with no tokenVersion claim (falsy tokenVersion skips the check)', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User' });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 7, isApproved: true });

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('accepts a token passed via the Authorization: Bearer header when no cookie is present', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: {}, headers: { authorization: `Bearer ${token}` } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOne.mockResolvedValue({ email: 'user@example.com', tokenVersion: 1, isApproved: true });

      await authenticateToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('proceeds without a user when no token is present', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(mockedFindOneAndUpdate).not.toHaveBeenCalled();
    });

    it('proceeds without blocking even when the token is invalid', async () => {
      const req = mockReq({ cookies: { access_token: 'garbage' } } as any);
      const res = mockRes();
      const next = jest.fn();

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('attaches req.user and upserts the DB user when the token is valid', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: { access_token: token } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOneAndUpdate.mockResolvedValue({ email: 'user@example.com' });

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ email: 'user@example.com' });
      expect(mockedFindOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('accepts a token passed via the Authorization: Bearer header when no cookie is present', async () => {
      const token = generateJWT({ id: '1', email: 'user@example.com', name: 'User', tokenVersion: 1 });
      const req = mockReq({ cookies: {}, headers: { authorization: `Bearer ${token}` } } as any);
      const res = mockRes();
      const next = jest.fn();
      mockedFindOneAndUpdate.mockResolvedValue({ email: 'user@example.com' });

      await optionalAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ email: 'user@example.com' });
    });
  });

  describe('requireRole', () => {
    it('rejects when req.dbUser is missing', () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      requireRole('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when the DB user lacks the required role', () => {
      const req = mockReq({ dbUser: { roles: ['member'] } } as any);
      const res = mockRes();
      const next = jest.fn();

      requireRole('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when the DB user has the required role', () => {
      const req = mockReq({ dbUser: { roles: ['admin'] } } as any);
      const res = mockRes();
      const next = jest.fn();

      requireRole('admin')(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireApproved', () => {
    it('rejects when req.dbUser is missing', () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      requireApproved(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects an unapproved user', () => {
      const req = mockReq({ dbUser: { isApproved: false } } as any);
      const res = mockRes();
      const next = jest.fn();

      requireApproved(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not approved' });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next for an approved user', () => {
      const req = mockReq({ dbUser: { isApproved: true } } as any);
      const res = mockRes();
      const next = jest.fn();

      requireApproved(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
