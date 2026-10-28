import { useCallback, useEffect, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { Plan } from '../services/types';
import { getPlans } from '../services/plans';
import { todayKey } from '../utils/dates';

/** How many upcoming plans the list shows above the logged days. */
const COMING_UP = 5;

/**
 * The plan dialog's state, and the next few plans shown above the journal.
 * The two live together because saving a plan has to refresh the list.
 */
export const usePlanEditor = (tenantGroupId: string | undefined) => {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [comingUp, setComingUp] = useState<Plan[]>([]);

  const loadComingUp = useCallback(async () => {
    try {
      setComingUp(
        await getPlans({
          groupId: tenantGroupId,
          upcoming: true,
          startDate: todayKey(),
          limit: COMING_UP
        })
      );
    } catch (e) {
      logger.error('Failed to load upcoming plans', e);
    }
  }, [tenantGroupId]);

  useEffect(() => {
    void loadComingUp();
  }, [loadComingUp]);

  const openPlan = useCallback((next: Plan | null, nextDate?: string) => {
    setPlan(next);
    setDate(nextDate);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, plan, date, comingUp, loadComingUp, openPlan, close };
};
