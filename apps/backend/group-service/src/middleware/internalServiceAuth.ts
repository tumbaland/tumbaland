import { Request } from 'express';
import { internalServiceTokenBypass, allowUserOrInternalService } from '@tumbaland/backend-core';

/**
 * Both middlewares now live in `@tumbaland/backend-core` — payment-service's
 * entitlement endpoint needed the same thing, and two copies of an auth check
 * is one copy too many. This module stays as the local name the routes already
 * import.
 *
 * The behaviour change that came with the move: the shared version compares
 * the token in constant time and, when the header is present, *verifies it
 * here* instead of deferring to a second middleware mounted per-router.
 * Previously a route that forgot to mount `validateInternalServiceToken` was
 * reachable by sending `x-internal-token: anything`, because
 * `authMiddleware.ts` skipped JWT verification on the header's mere presence.
 */
export const validateInternalServiceToken = internalServiceTokenBypass;
export { allowUserOrInternalService };

/** @deprecated `isInternalService`/`serviceIdentifier` live on `Request` itself. */
export type InternalServiceRequest = Request;
