import cron from 'node-cron';
import { logger, runUsageReconciliation } from '@tumbaland/backend-core';

/**
 * Nightly repair of the cumulative usage meters.
 *
 * The counters are a cache of data that lives elsewhere — photo sizes, active
 * ticker symbols, group membership — kept hot because a quota check cannot
 * afford the aggregation. Anything that interrupts a write between the resource
 * landing and `consumeQuota` updating the meter leaves drift, and since none of
 * these meters ever roll over, that drift is permanent until something
 * recomputes them. This is that something.
 *
 * **Scheduled here, in payment-service**, even though the source data belongs to
 * album-, finance- and group-service: this is a billing concern, payment-service
 * already owns entitlement truth, and every service shares one database so the
 * reads are local wherever it runs. Putting it in one of the data-owning
 * services would mean either three partial jobs or an arbitrary winner.
 *
 * 03:30 rather than on the hour, and well clear of finance-service's 22:00
 * price update: the job races live writes by design (a `consumeQuota` landing
 * mid-run is overwritten), which is tolerable precisely because the next run
 * re-derives the same number — but a quiet hour makes it rare rather than
 * routine.
 */
export function startUsageReconciliation(): void {
  cron.schedule('30 3 * * *', runUsageReconciliation);
  logger.info('Usage meter reconciliation scheduled', { schedule: '30 3 * * *' });
}
