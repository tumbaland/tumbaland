import crypto from 'crypto';

const HMAC_SECRET = (): string => {
  const secret = process.env.FILE_SERVICE_HMAC_SECRET;
  if (!secret) throw new Error('FILE_SERVICE_HMAC_SECRET env var is required');
  return secret;
};

export type TokenOperation = 'upload' | 'download';

/**
 * Build the HMAC message string: "operation:fileId:expiresMs", with
 * ":maxBytes" on the end for an upload bound to a size.
 */
const buildMessage = (operation: TokenOperation, fileId: string, expiresMs: number, maxBytes?: number): string =>
  maxBytes === undefined ? `${operation}:${fileId}:${expiresMs}` : `${operation}:${fileId}:${expiresMs}:${maxBytes}`;

/**
 * Sign a token for a given operation + fileId + expiry, and for an upload
 * optionally the most bytes it may write.
 */
export const signToken = (operation: TokenOperation, fileId: string, expiresMs: number, maxBytes?: number): string => {
  const message = buildMessage(operation, fileId, expiresMs, maxBytes);
  return crypto.createHmac('sha256', HMAC_SECRET()).update(message).digest('hex');
};

/**
 * Verify a token. Returns true if valid and not expired.
 */
export const verifyToken = (
  operation: TokenOperation,
  fileId: string,
  expiresMs: number,
  token: string,
  maxBytes?: number
): boolean => {
  if (Date.now() > expiresMs) return false;

  const expected = signToken(operation, fileId, expiresMs, maxBytes);
  const expectedBuf = Buffer.from(expected, 'hex');
  const tokenBuf = Buffer.from(token, 'hex');

  // A malformed/wrong-length token is a rejected token, not a server fault —
  // timingSafeEqual throws RangeError on mismatched lengths, so check first
  // rather than let the caller's try/catch turn this into a 500.
  if (tokenBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, tokenBuf);
};
