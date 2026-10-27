import dotenv from 'dotenv';

dotenv.config();

import mongoose from 'mongoose';
import { backfillUserDays } from '../services/backfillUserDays';

/**
 * Manual entry point: fills the visit history from what the data already knows
 * (see `backfillUserDays`). Run once after the release that starts counting
 * visits.
 *
 *   npm run backfill:user-days --workspace=auth-service            # dry run
 *   npm run backfill:user-days --workspace=auth-service -- --apply
 *
 * On the Pi, inside the running auth-service container, which has no ts-node:
 *
 *   docker exec <container> node dist/scripts/backfill-user-days.js --apply
 *
 * Safe to repeat: it only inserts days that have no row.
 */

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

async function run(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply');

  await mongoose.connect(mongoUri!);
  try {
    const report = await backfillUserDays({ apply });
    console.log(`${report.candidates} day(s) found in the audit trail and the accounts.`);
    console.log(`${report.alreadyRecorded} already have a row and are left alone.`);
    if (!apply) {
      const toWrite = report.candidates - report.alreadyRecorded;
      console.log(
        toWrite === 0 ? 'Nothing to write.' : `${toWrite} would be written. Re-run with --apply to write them.`
      );
      return;
    }
    console.log(`Wrote ${report.written} day(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
