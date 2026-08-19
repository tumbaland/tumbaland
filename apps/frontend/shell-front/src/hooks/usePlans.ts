import { useEffect, useState } from 'react';
import { CatalogPlan } from '@tumbaland/frontend-core';
import { getPlans } from '../services/plansService';

export interface PlansState {
  plans: CatalogPlan[];
  loading: boolean;
  /** True when the catalog could not be read. The page says so rather than inventing numbers. */
  failed: boolean;
}

/**
 * Loads the plan catalog once.
 *
 * Hand-rolled rather than react-query because shell-front does not have it —
 * one fetch on mount, and a failure is a *state*, not a thrown error: a landing
 * page that renders nothing because payment-service blinked is worse than one
 * that says pricing is temporarily unavailable. What it must never do is fall
 * back to hardcoded numbers; that is the defect this whole change removes.
 */
export function usePlans(): PlansState {
  const [state, setState] = useState<PlansState>({ plans: [], loading: true, failed: false });

  useEffect(() => {
    let active = true;

    getPlans()
      .then(plans => {
        if (active) setState({ plans, loading: false, failed: false });
      })
      .catch(() => {
        if (active) setState({ plans: [], loading: false, failed: true });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
