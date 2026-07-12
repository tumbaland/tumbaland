import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodType } from 'zod';
import { BadRequestError } from '../errors/HttpError';

/**
 * Validates `req.body` against a zod schema before the route handler runs.
 * On failure, throws a `BadRequestError` (caught by the shared errorHandler)
 * instead of letting controllers hand-roll their own field checks. On
 * success, `req.body` is replaced with the parsed result so handlers get
 * zod's inferred, coerced types rather than raw untyped input.
 */
export function validate(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
      throw new BadRequestError(`${field}${issue.message}`);
    }
    req.body = result.data;
    next();
  };
}
