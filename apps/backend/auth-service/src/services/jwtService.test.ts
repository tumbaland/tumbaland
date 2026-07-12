import * as jwt from 'jsonwebtoken';
import { generateJWT, verifyJWT, decodeJWT, UserPayload } from './jwtService';

const basePayload: UserPayload = { id: '1', email: 'user@example.com', name: 'User' };

describe('jwtService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-jwt-secret' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('generateJWT', () => {
    it('signs a token containing the given payload', () => {
      const token = generateJWT(basePayload);
      const decoded = jwt.verify(token, 'test-jwt-secret') as UserPayload;

      expect(decoded).toMatchObject(basePayload);
    });

    it('throws when JWT_SECRET is not configured', () => {
      delete process.env.JWT_SECRET;
      expect(() => generateJWT(basePayload)).toThrow('Missing required environment variable: JWT_SECRET');
    });
  });

  describe('verifyJWT', () => {
    it('returns the decoded payload for a valid token', () => {
      const token = generateJWT(basePayload);
      expect(verifyJWT(token)).toMatchObject(basePayload);
    });

    it('throws "Invalid or expired token" for a malformed token', () => {
      expect(() => verifyJWT('not-a-real-jwt')).toThrow('Invalid or expired token');
    });

    it('throws "Invalid or expired token" for a token signed with a different secret', () => {
      const token = jwt.sign(basePayload, 'a-different-secret', { expiresIn: '30m' });
      expect(() => verifyJWT(token)).toThrow('Invalid or expired token');
    });

    it('throws "Invalid or expired token" for an expired token', () => {
      const token = jwt.sign(basePayload, 'test-jwt-secret', { expiresIn: -1 });
      expect(() => verifyJWT(token)).toThrow('Invalid or expired token');
    });

    it('throws when JWT_SECRET is not configured', () => {
      const token = generateJWT(basePayload);
      delete process.env.JWT_SECRET;
      expect(() => verifyJWT(token)).toThrow('Missing required environment variable: JWT_SECRET');
    });
  });

  describe('decodeJWT', () => {
    it('decodes a valid token without verifying its signature', () => {
      const token = generateJWT(basePayload);
      expect(decodeJWT(token)).toMatchObject(basePayload);
    });

    it('returns null for a malformed token', () => {
      expect(decodeJWT('not-a-real-jwt')).toBeNull();
    });
  });
});
