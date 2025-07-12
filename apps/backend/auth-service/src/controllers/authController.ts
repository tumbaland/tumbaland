import { Request, Response, NextFunction } from 'express';
import { verifyGoogleToken } from '../services/googleAuthService';
import { generateJWT, UserPayload } from '../services/jwtService';

export const validateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorizedEmails = (process.env.AUTHORIZED_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }
    const googleUser = await verifyGoogleToken(idToken);

    if (!googleUser) {
      res.status(401).json({ success: false, message: 'Invalid Google token' });
      return;
    }

    // Check if the user's email is authorized
    const userEmail = googleUser.email || '';
    if (!authorizedEmails.includes(userEmail)) {
      res.status(403).json({ success: false, message: 'Email is not authorized' });
      return;
    }

    // Create our own JWT token with user info
    const userPayload: UserPayload = {
      id: googleUser.sub || '',
      email: googleUser.email || '',
      name: googleUser.name || '',
      picture: googleUser.picture
    };

    const jwtToken = generateJWT(userPayload);

    // Set secure cookie for SSO across subdomains
    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    res.cookie('access_token', jwtToken, cookieOptions);

    res.json({
      success: true,
      user: userPayload,
      token: jwtToken // Also return token for manual storage if needed
    });
  } catch (error) {
    console.error('validateToken error:', error);
    const message = error instanceof Error ? error.message : 'Token validation failed';
    res.status(401).json({ success: false, message });
  }
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('access_token', {
    domain: process.env.COOKIE_DOMAIN || 'localhost',
    path: '/'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getProfile = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  res.json({ success: true, user: req.user });
};

export const verifyAuth = (req: Request, res: Response): void => {
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null
  });
};
