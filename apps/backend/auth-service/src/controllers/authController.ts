import { Request, Response, NextFunction } from 'express';
import { verifyGoogleToken } from '../services/googleAuthService';
import { generateJWT, UserPayload } from '../services/jwtService';
import { User } from '../models/User';

export const validateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
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

    const userEmail = googleUser.email || '';
    if (!userEmail) {
      res.status(400).json({ success: false, message: 'Email not present in Google token' });
      return;
    }

    // Create our own JWT token with user info
    const userPayload: UserPayload = {
      id: googleUser.sub || '',
      email: googleUser.email || '',
      name: googleUser.name || '',
      picture: googleUser.picture
    };

    // Upsert DB user (manual approval flow)
    const dbUser = await User.findOneAndUpdate(
      { email: userEmail.toLowerCase() },
      {
        $setOnInsert: {
          email: userEmail.toLowerCase(),
          signupMethod: 'google'
        },
        $set: { lastLoginAt: new Date() }
      },
      { new: true, upsert: true }
    );

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
      approved: dbUser.isApproved,
      token: jwtToken
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
  const dbUser = (req as any).dbUser;
  res.json({ success: true, user: req.user, approved: dbUser ? dbUser.isApproved : undefined });
};

export const verifyAuth = (req: Request, res: Response): void => {
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null
  });
};
