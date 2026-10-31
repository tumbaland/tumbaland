import type { NextFunction, Request, RequestHandler, Response } from 'express';
import logger from '../logging/logger';

/**
 * Where a request's time went, for the two places that need to know.
 *
 * A slow request is a mystery from the browser: the network tab shows one long
 * bar, and "the server was slow" covers a stalled database, a lookup in another
 * service that ran into its timeout, and a handler that simply did a lot of work.
 * Naming the phases settles which it was without a profiler on a Raspberry Pi.
 *
 *  - `Server-Timing`, which the browser's network panel shows under Timing, so
 *    a slow call can be read straight off the request that was slow.
 *  - A warning in the logs for any request over a threshold, with the same
 *    figures, so a slow one that nobody had the panel open for is still found.
 */

type Timings = Record<string, number>;

const timingsOf = (res: Response): Timings => {
  const locals = (res.locals ??= {}) as { timings?: Timings };
  return (locals.timings ??= {});
};

/** Notes how long a named phase took, and publishes all the phases so far as `Server-Timing`. */
export function recordTiming(res: Response, name: string, ms: number): void {
  const timings = timingsOf(res);
  timings[name] = Math.round(ms * 10) / 10;

  // Headers are final once the body has started, so a late note is only logged.
  if (typeof res.setHeader !== 'function' || res.headersSent) return;
  res.setHeader(
    'Server-Timing',
    Object.entries(timings)
      .map(([phase, dur]) => `${phase};dur=${dur}`)
      .join(', ')
  );
}

/** Ids are removed from a path, so slow requests group by route instead of by record. */
const routeOf = (url: string): string => url.split('?')[0]!.replace(/[a-f0-9]{24}/gi, ':id');

/**
 * Logs a warning for every request that took `thresholdMs` or longer, with the
 * phases recorded along the way. A long-lived stream is not slow, it is a stream.
 */
export function slowRequestLogger(thresholdMs = 1000): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    res.on('finish', () => {
      const ms = performance.now() - started;
      if (ms < thresholdMs) return;
      if (String(res.getHeader('Content-Type') ?? '').includes('text/event-stream')) return;
      logger.warn('Slow request', {
        method: req.method,
        route: routeOf(req.originalUrl ?? req.url),
        status: res.statusCode,
        ms: Math.round(ms),
        timings: timingsOf(res)
      });
    });
    next();
  };
}
