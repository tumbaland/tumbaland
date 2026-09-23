import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenOperation } from '../utils/hmac';

/**
 * Whether two secrets match, in time that does not depend on where they differ.
 * Both are hashed first so their lengths match, which `timingSafeEqual` needs,
 * without the length check itself saying how long the real key is.
 */
const sameSecret = (given: string, expected: string): boolean =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(given).digest(),
    crypto.createHash('sha256').update(expected).digest()
  );

/**
 * Middleware: internal API key authentication.
 * Services communicate with X-Internal-Api-Key header.
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['x-internal-api-key'];
  const expected = process.env.FILE_SERVICE_API_KEY;
  if (!expected || typeof key !== 'string' || !sameSecret(key, expected)) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  next();
};

/**
 * Middleware factory: validate a signed URL token for browser-direct requests.
 * Expects ?token=...&expires=... query params alongside the :fileId route param.
 */
export const requireSignedToken = (operation: TokenOperation) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { token, expires } = req.query as { token?: string; expires?: string };
    const fileId = [req.params.fileId].flat().join('/');

    if (!token || !expires) {
      res.status(401).json({ success: false, message: 'Missing token or expires' });
      return;
    }

    const expiresMs = parseInt(expires, 10);
    if (isNaN(expiresMs)) {
      res.status(400).json({ success: false, message: 'Invalid expires value' });
      return;
    }

    // The size an upload was signed for. Part of the signature, so it cannot
    // be raised or dropped from the URL.
    const { max } = req.query as { max?: string };
    if (max !== undefined && !/^\d{1,15}$/.test(max)) {
      res.status(400).json({ success: false, message: 'Invalid max value' });
      return;
    }
    const maxBytes = max === undefined ? undefined : Number(max);

    let valid: boolean;
    try {
      valid = verifyToken(operation, fileId, expiresMs, token, maxBytes);
    } catch {
      res.status(500).json({ success: false, message: 'Token verification failed' });
      return;
    }

    if (!valid) {
      res.status(403).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    res.locals.maxBytes = maxBytes;
    next();
  };
