import { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError, PaymentRequiredError } from './HttpError';

describe('HttpError', () => {
  it('carries the given status code and message', () => {
    const error = new HttpError(418, "I'm a teapot");
    expect(error.statusCode).toBe(418);
    expect(error.message).toBe("I'm a teapot");
    expect(error).toBeInstanceOf(Error);
  });

  it('sets name to the concrete subclass name', () => {
    expect(new HttpError(400, 'x').name).toBe('HttpError');
  });

  it('carries optional details for the error handler to serialize', () => {
    expect(new HttpError(400, 'x').details).toBeUndefined();
    expect(new HttpError(400, 'x', { field: 'title' }).details).toEqual({ field: 'title' });
  });
});

describe('PaymentRequiredError', () => {
  it('is a 402 — "you may, for money" — and never a 403', () => {
    const error = new PaymentRequiredError('Storage limit reached', {
      code: 'QUOTA_EXCEEDED',
      meter: 'storageBytes',
      used: 10,
      limit: 10,
      planCode: 'free',
      upgradeTo: 'support'
    });

    expect(error.statusCode).toBe(402);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.details).toEqual({
      code: 'QUOTA_EXCEEDED',
      meter: 'storageBytes',
      used: 10,
      limit: 10,
      planCode: 'free',
      upgradeTo: 'support'
    });
  });

  it('copies the details, so a caller reusing its object cannot mutate the error', () => {
    const details = { code: 'QUOTA_EXCEEDED', meter: 'seats' };
    const error = new PaymentRequiredError('Seat limit reached', details);

    details.meter = 'aiJobs';

    expect(error.details?.meter).toBe('seats');
  });
});

describe.each([
  [BadRequestError, 400, 'Bad request'],
  [UnauthorizedError, 401, 'Unauthorized'],
  [ForbiddenError, 403, 'Access denied'],
  [NotFoundError, 404, 'Not found'],
  [ConflictError, 409, 'Conflict'],
  [TooManyRequestsError, 429, 'Too many requests']
] as const)('%p', (ErrorClass, expectedStatus, defaultMessage) => {
  it(`defaults to status ${expectedStatus} and a sensible message`, () => {
    const error = new ErrorClass();
    expect(error.statusCode).toBe(expectedStatus);
    expect(error.message).toBe(defaultMessage);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(ErrorClass.name);
  });

  it('accepts a custom message', () => {
    const error = new ErrorClass('custom message');
    expect(error.statusCode).toBe(expectedStatus);
    expect(error.message).toBe('custom message');
  });
});
