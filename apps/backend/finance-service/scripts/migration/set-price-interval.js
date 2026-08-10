/**
 * Stamp `interval: 'daily'` on price rows written before the field existed.
 *
 * **This is not cosmetic.** Once weekly closes exist, uniqueness and every
 * upsert key on `tickerpricehistories` includes `interval`. A daily upsert now
 * filters on `{ ticker, interval: 'daily', date }`, which does not match a
 * legacy row that has no `interval` — so re-fetching a date the collection
 * already holds would insert a *second* row for it rather than updating the
 * first. Reads tolerate the missing field; writes cannot.
 *
 * Run this before or with the deploy that introduces weekly history.
 *
 * Safe to re-run: it only touches rows where the field is absent.
 *
 * Usage:
 *   node scripts/migration/set-price-interval.js            # dry run
 *   node scripts/migration/set-price-interval.js --apply
 */
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

const INDEX_NAME = 'ticker_1_interval_1_date_1';

async function run() {
  await mongoose.connect(mongoUri);
  const apply = process.argv.slice(2).includes('--apply');

  try {
    const col = mongoose.connection.db.collection('tickerpricehistories');
    const filter = { interval: { $exists: false } };

    const missing = await col.countDocuments(filter);
    const total = await col.countDocuments({});
    console.log(`${missing} of ${total} price rows have no interval; all of them predate weekly history and are daily closes.`);

    if (!apply) {
      if (missing > 0) {
        const sample = await col.find(filter).limit(3).project({ ticker: 1, date: 1 }).toArray();
        sample.forEach(r => console.log(`  e.g. ${r.ticker} ${r.date.toISOString().slice(0, 10)}`));
      }
      const names = (await col.indexes()).map(i => i.name);
      console.log(
        names.includes(INDEX_NAME)
          ? `Unique index ${INDEX_NAME} already exists.`
          : `Would create unique index ${INDEX_NAME}.`
      );
      console.log('\nDry run. Re-run with --apply.');
      return;
    }

    if (missing > 0) {
      const result = await col.updateMany(filter, { $set: { interval: 'daily' } });
      console.log(`Stamped ${result.modifiedCount} rows as daily.`);
    }

    // Both steps run on every invocation, and neither is conditional on the
    // other. An earlier version returned early once every row was stamped,
    // which meant a re-run silently skipped the index — leaving the collection
    // in exactly the half-migrated state this script exists to avoid.
    //
    // Created here rather than left to a service boot: mongoose builds a
    // schema's indexes on startup, which would make deploy *order*
    // load-bearing. Idempotent — an existing index with the same key and
    // options is a no-op.
    const indexName = await col.createIndex({ ticker: 1, interval: 1, date: 1 }, { unique: true });
    console.log(`Ensured unique index ${indexName}.`);
    console.log('Now run drop-stale-indexes.js --apply to retire ticker_1_date_1.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
