import { Request, Response } from 'express';
import { recordActivity, UnauthorizedError } from '@tumbaland/backend-core';
import { countryOf } from '../services/sessionService';

/**
 * Counts a visit or a page open for the signed-in person.
 *
 * Reported by shell-front rather than inferred from requests, because requests
 * are not visits: chat holds a live connection and polls for as long as a tab is
 * open, so counting them would make an idle tab look like constant use.
 *
 * Always a 204, whether or not the count could be written. The page sends this
 * without waiting and has nothing to do with a failure, and a counter must
 * never be the reason something looks broken.
 *
 * Reachable only with a session: `authenticateToken` refuses connected
 * assistants and keys, and software opening nothing is not a visit.
 */
export const postActivity = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const { kind, module, platform } = req.body as {
    kind: 'visit' | 'open';
    module?: Parameters<typeof recordActivity>[0]['module'];
    platform: Parameters<typeof recordActivity>[0]['platform'];
  };

  await recordActivity({ userId: req.user.id, kind, module, platform, country: countryOf(req) });
  res.status(204).end();
};
