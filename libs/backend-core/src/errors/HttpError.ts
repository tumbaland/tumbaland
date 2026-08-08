/**
 * Base class for errors that should be turned into a specific HTTP response
 * by the shared errorHandler, instead of every controller hand-rolling
 * try/catch + string-matching on error.message to pick a status code.
 *
 * Express 5 forwards rejected promises from async route handlers to the
 * mounted error handler automatically, so controllers can just
 * `throw new NotFoundError(...)` and stop wrapping in try/catch.
 */
export class HttpError extends Error {
  statusCode: number;
  /**
   * Extra fields merged into the JSON body by the shared errorHandler. Used by
   * errors the client has to *act* on rather than just display — a 402 tells
   * the upgrade dialog which meter blocked and which plan lifts it.
   */
  details?: Record<string, unknown>;

  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.details = details;
    // Restore the prototype chain (needed when compiling to ES2018 targets
    // where `extends Error` doesn't preserve instanceof checks correctly).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Access denied') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests') {
    super(429, message);
  }
}

/**
 * Fields the upgrade dialog renders. Every one of them comes from the response
 * body, so the dialog needs no knowledge of which call failed.
 */
export interface PaymentRequiredDetails {
  /** Machine-readable reason, e.g. `QUOTA_EXCEEDED` or `FEATURE_NOT_IN_PLAN`. */
  code: string;
  meter?: string;
  feature?: string;
  used?: number;
  limit?: number;
  planCode?: string;
  /** The cheapest plan that lifts this particular limit, when one exists. */
  upgradeTo?: string;
}

/**
 * 402, never 403. 403 means "you may not"; 402 means "you may, for money" —
 * and the frontend needs to tell those apart to choose between an error toast
 * and an upgrade dialog.
 */
export class PaymentRequiredError extends HttpError {
  constructor(message: string, details: PaymentRequiredDetails) {
    super(402, message, { ...details });
  }
}
