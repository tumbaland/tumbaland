import { OAuth2Client } from 'google-auth-library';
import { logger } from '@tumbaland/backend-core';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Every Google OAuth client whose ID tokens this service accepts.
 *
 * The web sign-in button uses GOOGLE_CLIENT_ID. A native iOS or Android app has
 * to sign in with a client ID of its own, because Google does not allow its
 * sign-in page inside an app's web view, and the token it gets back names that
 * client as its audience. Listing those IDs in GOOGLE_NATIVE_CLIENT_IDS
 * (comma-separated) is all an app needs from this service: it posts its token
 * to the same /auth/validate and gets the same session cookie.
 */
export const allowedGoogleClientIds = (env: NodeJS.ProcessEnv = process.env): string[] =>
  [env.GOOGLE_CLIENT_ID, ...(env.GOOGLE_NATIVE_CLIENT_IDS ?? '').split(',')]
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));

export const verifyGoogleToken = async (idToken: string) => {
  const audience = allowedGoogleClientIds();
  // Without an audience the library skips the check and accepts a token issued
  // to any Google client, including one somebody else registered.
  if (audience.length === 0) {
    logger.error('Google sign-in is not configured: GOOGLE_CLIENT_ID is empty');
    throw new Error('Invalid token');
  }

  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    return payload; // Contains user info like email, name, etc.
  } catch (error) {
    logger.error('Error verifying Google token', { error: (error as Error)?.message });
    throw new Error('Invalid token');
  }
};
