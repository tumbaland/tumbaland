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

    // Upsert DB user (automatic approval for new users)
    const dbUser = await User.findOneAndUpdate(
      { email: userEmail.toLowerCase() },
      {
        $setOnInsert: {
          email: userEmail.toLowerCase(),
          signupMethod: 'google',
          isApproved: true
        },
        $set: { lastLoginAt: new Date() }
      },
      { new: true, upsert: true }
    );

    if (!dbUser) {
      res.status(500).json({ success: false, message: 'Failed to create or find user' });
      return;
    }

    // Update userPayload to use database user ID instead of Google sub
    const userPayload: UserPayload = {
      id: (dbUser._id as any).toString(), // Use MongoDB _id instead of Google sub
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

export const verifyAuth = (req: Request, res: Response): void => {
  res.json({
    success: true,
    authenticated: !!req.user,
    user: req.user || null
  });
};
