import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { actorOf, type Actor } from './actor';
import { recordRead } from './reads';

/**
 * The actor, reachable from wherever the write actually happens.
 *
 * Attribution has to come from the request and be recorded at the data layer,
 * and those are far apart: a Mongoose hook knows exactly which fields changed
 * and nothing about who asked. Threading an actor through every service and
 * controller signature to bridge that would touch every function between the
 * two and be silently wrong the first time someone forgot.
 *
 * `AsyncLocalStorage` carries it instead, so the hook reads the actor without
 * anything in between knowing it exists. A write outside a request — a script,
 * a migration — simply finds no actor, which is the truth about it.
 */
export interface AuditContext {
  actor: Actor;
  service: string;
}

const storage = new AsyncLocalStorage<AuditContext>();

export const currentAuditContext = (): AuditContext | undefined => storage.getStore();

/**
 * Run the rest of a request with its actor in scope.
 *
 * Mounted after authentication, since there is no actor before it.
 */
export const auditContext =
  (service: string): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const actor = actorOf(req);
    if (!actor) {
      next();
      return;
    }

    storage.run({ actor, service }, next);
  };

/** Run something with an explicit actor — for jobs and tests. */
export const withAuditContext = <T>(context: AuditContext, fn: () => T): T =>
  storage.run(context, fn);

/**
 * The service this process is, for a trail that spans several of them.
 *
 * `SERVICE_NAME` is already how metrics, health and the internal-service clients
 * identify a process, so auditing uses the same one rather than introducing a
 * second name for the same thing.
 *
 * The fallback to the package name matters more here than elsewhere: the trail
 * is filtered by service in the UI, and in local development nothing sets
 * `SERVICE_NAME`, so every row would land under one meaningless label and the
 * filter would look broken. Every service's package is named after it.
 */
const serviceName = (): string =>
  process.env.SERVICE_NAME || process.env.npm_package_name || 'unknown-service';

/**
 * Put a request's actor in scope, and arm the read trail, for everything after.
 *
 * Called from `authenticateAgent` rather than mounted as its own middleware. A
 * separate mount only works on a router that authenticates with
 * `router.use(...)`; routers that authenticate per route — album's photos,
 * finance's tickers — have no actor yet when a router-level middleware runs, so
 * the context would be silently empty for exactly the endpoints most worth
 * auditing. Doing it where authentication happens makes the two inseparable.
 */
export function beginAudit(req: Request, res: Response, next: NextFunction): void {
  const actor = actorOf(req);
  if (!actor) {
    next();
    return;
  }

  recordRead(req, res, actor, serviceName());
  storage.run({ actor, service: serviceName() }, next);
}
