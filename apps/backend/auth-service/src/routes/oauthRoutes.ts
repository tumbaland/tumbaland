import { Router } from 'express';
import express from 'express';
import { createRateLimiter } from '@tumbaland/backend-core';
import {
  authorizationServerMetadata,
  registerOAuthClient,
  authorize,
  authorizeDecision,
  token
} from '../controllers/oauthController';
import { optionalAuth, authenticateToken, requireApproved } from '../middleware/authMiddleware';

const router = Router();

/**
 * Registration gets its own budget rather than sharing `strictRateLimiter`.
 *
 * That export is a single instance, so every route using it draws on one
 * counter: someone brute-forcing the login endpoint would lock an unrelated
 * caller out of client registration, and the two have nothing to do with each
 * other. A dedicated limiter keeps the blast radius to the thing being abused.
 */
const registrationLimiter = createRateLimiter({ max: 20 });

/**
 * OAuth 2.1, for assistants connecting over MCP.
 *
 * `/authorize` uses `optionalAuth` rather than `authenticateToken`: an
 * unauthenticated visitor is not an error here, it is someone who needs to sign
 * in first, and the handler bounces them through the ordinary login.
 */
router.get('/authorize', optionalAuth, authorize);

// The consent form posts back as a normal HTML form, not JSON. Unlike the GET
// there is no anonymous path here — anyone submitting a decision has already
// been through login — so this requires a real, approved session rather than
// tolerating an absent one.
router.post(
  '/authorize',
  express.urlencoded({ extended: false }),
  authenticateToken,
  requireApproved,
  authorizeDecision
);

// Both are unauthenticated by design: registration grants nothing on its own,
// and the token endpoint authenticates by the code or refresh token it carries.
router.post('/register', registrationLimiter, registerOAuthClient);
router.post('/token', express.urlencoded({ extended: false }), token);

export { authorizationServerMetadata };
export default router;
