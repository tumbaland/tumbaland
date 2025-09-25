import jwt from 'jsonwebtoken';

// Configuration
const JWT_SECRET = process.env.FILE_ACCESS_SECRET || '';
const DEFAULT_EXPIRATION = 5; // minutes

// Interface for signed URL data
export interface SignedUrlData {
  fileId: string;
  action: 'read' | 'write';
  expiresAt: number;
  issuedAt: number;
}

// Generate a signed token for file access
export const generateSignedToken = (
  fileId: string,
  action: 'read' | 'write' = 'read',
  expirationMinutes: number = DEFAULT_EXPIRATION
): string => {
  const payload: SignedUrlData = {
    fileId,
    action,
    expiresAt: Date.now() + (expirationMinutes * 60 * 1000),
    issuedAt: Date.now()
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
};

// Verify and decode a signed token
export const verifySignedToken = (token: string): SignedUrlData => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as SignedUrlData;

    // Check if token has expired
    if (Date.now() > decoded.expiresAt) {
      throw new Error('Token has expired');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    throw error;
  }
};

// Generate a signed URL for file access
export const generateSignedUrl = (
  baseUrl: string,
  fileId: string,
  action: 'read' | 'write' = 'read',
  expirationMinutes: number = DEFAULT_EXPIRATION
): string => {
  const token = generateSignedToken(fileId, action, expirationMinutes);

  const url = new URL(baseUrl);
  url.searchParams.set('token', token);

  return url.toString();
};

// Extract and verify token from URL
export const verifySignedUrl = (url: string): SignedUrlData => {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      throw new Error('No token found in URL');
    }

    return verifySignedToken(token);
  } catch (error) {
    throw new Error('Invalid signed URL');
  }
};

// Generate a secure file access URL (internal use)
export const generateFileAccessUrl = (
  fileId: string,
  action: 'read' | 'write' = 'read',
  expirationMinutes: number = DEFAULT_EXPIRATION
): string => {
  // Use public URL for client access (browser needs to access this directly)
  const baseUrl = `${process.env.FILE_API_URL}/api/serve/${fileId}`;
  return generateSignedUrl(baseUrl, fileId, action, expirationMinutes);
};

// Middleware to verify signed URL tokens
export const verifySignedUrlMiddleware = (req: any, res: any, next: any) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = verifySignedToken(token);

    // Attach token data to request for use in controllers
    req.fileAccess = tokenData;

    // Check if the fileId in the URL matches the token
    if (req.params.fileId && req.params.fileId !== tokenData.fileId) {
      return res.status(403).json({ error: 'Token does not match requested file' });
    }

    next();
  } catch (error) {
    return res.status(403).json({
      error: (error as Error).message || 'Invalid access token'
    });
  }
};

// Generate upload URL for direct client uploads
export const generateUploadUrl = (
  fileId: string,
  contentType: string,
  expirationMinutes: number = 15
): string => {
  // Use public URL for client uploads (browser needs to access this directly)
  const baseUrl = `${process.env.FILE_API_URL}/api/upload/direct/${fileId}`;
  return generateSignedUrl(baseUrl, fileId, 'write', expirationMinutes);
};