import { Router } from 'express';
import { requireInternalServiceToken, validate } from '@tumbaland/backend-core';
import { collageActivitySchema, planReminderSchema } from '../validation/schemas';
import { collageActivity, type CollageActivity } from '../services/collageService';
import { postPlanReminder, type PlanReminderInput } from '../services/reminderService';

/**
 * Service-to-service surface, for album-service and relationship-service. No
 * user JWT is involved and no browser ever reaches these routes: the shared
 * internal-token middleware verifies the token itself, constant-time.
 */
const router = Router();

router.use(requireInternalServiceToken);

/** Someone opened a collage made from a chat: nudge the others in it. */
router.post('/collage-activity', validate(collageActivitySchema), async (req, res) => {
  const notified = await collageActivity(req.body as CollageActivity);
  res.json({ success: true, data: { notified } });
});

/** A plan in the journal is coming up: relationship-service's reminder sweep. */
router.post('/plan-reminder', validate(planReminderSchema), async (req, res) => {
  const result = await postPlanReminder(req.body as PlanReminderInput);
  res.json({ success: true, data: result });
});

export default router;
