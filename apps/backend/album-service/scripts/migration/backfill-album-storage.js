const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

// One-time backfill for the photoCount/totalSize fields added to Album.
// Existing albums predate those fields (they default to 0), so they need
// this to be seeded once from the photos collection; every write going
// forward keeps them in sync via photoService's atomic $inc calls, so this
// script should never need to run again outside a one-off data repair.
const albumSchema = new mongoose.Schema({}, { collection: 'albums', strict: false, versionKey: false });
const photoSchema = new mongoose.Schema({}, { collection: 'photos', strict: false, versionKey: false });

const Album = mongoose.model('MigrationAlbum', albumSchema);
const Photo = mongoose.model('MigrationPhoto', photoSchema);

async function run() {
  await mongoose.connect(mongoUri);
  try {
    const argv = process.argv.slice(2);
    const applyMode = argv.includes('--apply');

    const totals = await Photo.aggregate([
      {
        $group: {
          _id: '$albumId',
          photoCount: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]).allowDiskUse(true);

    console.log(`Computed totals for ${totals.length} album(s) from the photos collection.`);

    if (!applyMode) {
      const preview = totals.slice(0, 10);
      preview.forEach((row) =>
        console.log(`  album=${row._id} photoCount=${row.photoCount} totalSize=${row.totalSize}`)
      );
      if (totals.length > preview.length) {
        console.log(`  ...and ${totals.length - preview.length} more`);
      }
      console.log('Run with --apply to write these totals to the albums collection.');
      return;
    }

    const bulkOps = totals.map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { photoCount: row.photoCount, totalSize: row.totalSize } }
      }
    }));

    // Albums with zero photos never appear in the aggregation above (no
    // matching photos to $group), so they'd otherwise be skipped — but they
    // still need photoCount/totalSize explicitly zeroed for albums created
    // before these fields existed.
    const albumIdsWithPhotos = new Set(totals.map((row) => String(row._id)));
    const zeroAlbums = await Album.find(
      { _id: { $nin: Array.from(albumIdsWithPhotos) } },
      { _id: 1 }
    ).lean();

    for (const album of zeroAlbums) {
      bulkOps.push({
        updateOne: {
          filter: { _id: album._id },
          update: { $set: { photoCount: 0, totalSize: 0 } }
        }
      });
    }

    if (bulkOps.length === 0) {
      console.log('No albums to update.');
      return;
    }

    const result = await Album.bulkWrite(bulkOps);
    console.log(`Updated ${result.modifiedCount} of ${bulkOps.length} album(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
