import dotenv from 'dotenv';

dotenv.config();

import mongoose from 'mongoose';
import { reconcileUsageMeters, MeterChange, ReconcileReport } from '@tumbaland/backend-core';

/**
 * Manual entry point for the usage-meter reconciliation that
 * `usageReconciliation.service.ts` otherwise runs nightly at 03:30.
 *
 * The scheduled run always applies. This exists for the two cases a cron cannot
 * serve: seeing what *would* change before it does, and repairing one account
 * on demand without waiting for the small hours.
 *
 *   npm run reconcile:usage --workspace=payment-service                 # dry run
 *   npm run reconcile:usage --workspace=payment-service -- --apply
 *   npm run reconcile:usage --workspace=payment-service -- --user=a@b.com --apply
 *
 * Lives under `src/` rather than a sibling `scripts/` so that `rootDir` covers
 * it and `npm run typecheck` catches a drifting `ReconcileReport` shape. It
 * therefore also compiles into the image, which is the point: repairing an
 * account in production is `node dist/scripts/reconcile-usage.js --apply`
 * inside the running container, with no ts-node toolchain needed.
 */

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

/** Console only — nothing downstream parses this. */
function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

const format = (change: MeterChange): string =>
  change.meter === 'storageBytes' ? `${change.to} (${humanBytes(change.to)})` : String(change.to);

function print(report: ReconcileReport, onlyUser?: string): void {
  console.log(`Scanned ${report.scannedUsers} user(s); ${report.subjects} subject(s) carry attributable usage.`);
  if (onlyUser) console.log(`Restricted to --user=${onlyUser}.`);
  console.log('');

  for (const [subject, meters] of Object.entries(report.expected)) {
    console.log(`  ${subject}`);
    console.log(`    storageBytes    ${meters.storageBytes} (${humanBytes(meters.storageBytes)})`);
    console.log(`    trackedTickers  ${meters.trackedTickers}`);
    console.log(`    seats           ${meters.seats}`);
  }

  if (report.changes.length > 0) {
    console.log('');
    console.log('Corrections:');
    for (const change of report.changes) {
      console.log(`  ${change.subjectId} ${change.meter}: ${change.from ?? 'absent'} -> ${format(change)}`);
    }
  }

  if (report.orphanedMeters.length > 0) {
    console.log('');
    console.log('Meters for subjects with no attributable usage (left untouched, review manually):');
    for (const meter of report.orphanedMeters) {
      console.log(`  ${meter.subjectId} ${meter.meter} = ${meter.count}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log('');
    console.log(`Warnings (${report.warnings.length}):`);
    for (const warning of report.warnings) console.log(`  ! ${warning}`);
  }

  console.log('');
  console.log('aiJobs is not reconciled: nothing but the counter records that a job ran,');
  console.log('so there is no source data to recompute it from.');
  console.log('');
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const userArg = argv.find(a => a.startsWith('--user='));
  const subject = userArg ? userArg.slice('--user='.length).trim().toLowerCase() : undefined;

  await mongoose.connect(mongoUri!);
  try {
    const report = await reconcileUsageMeters({ apply, subject });
    print(report, subject);

    if (report.changes.length === 0) {
      console.log('Meters already match the data. Nothing to write.');
      return;
    }
    if (!apply) {
      console.log(`${report.changes.length} meter(s) would be written. Re-run with --apply to write them.`);
      return;
    }
    console.log(`Wrote ${report.written} meter(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err: Error) => {
  console.error('Error:', err);
  process.exit(1);
});
