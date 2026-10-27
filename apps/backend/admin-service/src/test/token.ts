import jwt from 'jsonwebtoken';

/** A session token as auth-service signs one, for the routes' tests (the test setup treats every session as live). */
export function generateToken(claims: { roles?: string[] } = {}): string {
  return jwt.sign(
    {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      sid: 'a'.repeat(24),
      tokenVersion: 1,
      roles: claims.roles ?? []
    },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
}
