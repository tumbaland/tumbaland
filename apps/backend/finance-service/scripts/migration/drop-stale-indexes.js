/**
 * Retire indexes the schemas no longer declare.
 *
 * Mongoose creates the indexes a schema declares but never drops ones it has
 * stopped declaring, so narrowing or widening a constraint leaves the old one
 * enforcing the old rule forever. That is harmless for a plain index and fatal
 * for a unique one: `tickerpricehistories` gained weekly closes, which land on
 * dates the daily series already holds, and the old `{ ticker, date }` unique
 * index rejects them as duplicates of a series they are not part of.
 *
 * Safe to re-run: an index that is already gone is reported and skipped.
 *
 * Usage:
 *   node scripts/migration/drop-stale-indexes.js            # dry run
 *   node scripts/migration/drop-stale-indexes.js --apply
 */
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

/** Collection → index names that no schema declares any more, with the reason. */
const STALE = [
  {
    collection: 'tickerpricehistories',
    index: 'ticker_1_date_1',
    replacedBy: 'ticker_1_interval_1_date_1',
    why: 'weekly closes share dates with the daily series; uniqueness is per interval'
  }
];

async function run() {
  await mongoose.connect(mongoUri);
  const apply = process.argv.slice(2).includes('--apply');

  try {
    for (const { collection, index, replacedBy, why } of STALE) {
      const col = mongoose.connection.db.collection(collection);
      const names = (await col.indexes()).map(i => i.name);

      if (!names.includes(index)) {
        console.log(`${collection}.${index}: already gone`);
        continue;
      }

      // Never drop the old constraint before its replacement exists, or the
      // collection spends the gap with no uniqueness enforced at all.
      if (replacedBy && !names.includes(replacedBy)) {
        console.log(
          `${collection}.${index}: NOT dropping — its replacement ${replacedBy} does not exist yet. ` +
            'Start the service once so mongoose creates it, then re-run.'
        );
        continue;
      }

      console.log(`${collection}.${index}: stale (${why}), replaced by ${replacedBy}`);
      if (apply) {
        await col.dropIndex(index);
        console.log('  dropped');
      }
    }

    if (!apply) console.log('\nDry run. Re-run with --apply to drop.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
