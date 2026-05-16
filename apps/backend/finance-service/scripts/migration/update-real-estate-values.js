const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

// Simple version: list or apply update
const assetClassSchema = new mongoose.Schema({ name: String }, { collection: 'assetclasses', versionKey: false });
const assetAllocationSchema = new mongoose.Schema({}, { collection: 'assetallocations', strict: false, versionKey: false });

const AssetClass = mongoose.model('MigrationAssetClass', assetClassSchema);
const AssetAllocation = mongoose.model('MigrationAssetAllocation', assetAllocationSchema);

async function run() {
  await mongoose.connect(mongoUri);
  try {
    const realEstateClasses = await AssetClass.find({ name: /^real estate$/i }, { _id: 1 }).lean();
    if (!realEstateClasses || realEstateClasses.length === 0) {
      console.log('No asset class named "Real estate" found.');
      return;
    }

    const OLD_VALUE = 100000;
    const NEW_VALUE = 150000;

    const argv = process.argv.slice(2);
    const applyMode = argv.includes('--apply');

    // 1) List: aggregation to reliably match asset class
    const listPipeline = [
      { $lookup: {
          from: 'assetclasses',
          let: { acId: '$assetClassId' },
          pipeline: [ { $match: { $expr: { $eq: [ { $toString: '$_id' }, { $toString: '$$acId' } ] } } }, { $project: { name: 1 } } ],
          as: 'assetClass'
      }},
      { $unwind: '$assetClass' },
      { $match: { 'assetClass.name': { $regex: '^real estate$', $options: 'i' } } },
      { $project: { _id: 1, totalValue: 1, date: 1 } },
      { $sort: { date: -1 } }
    ];

    const allMatches = await AssetAllocation.aggregate(listPipeline).allowDiskUse(true);
    console.log(`Found ${allMatches.length} Real estate allocation(s).`);
    allMatches.forEach((r, i) => console.log(`#${i+1}: id=${r._id} totalValue=${r.totalValue} date=${r.date}`));

    if (!applyMode) {
      console.log('Run with --apply to update all allocations with totalValue=' + OLD_VALUE + ' to ' + NEW_VALUE + '.');
      return;
    }

    // 2) Apply: filter only those with OLD_VALUE and update
    const toUpdateIds = allMatches.filter(r => Number(r.totalValue) === OLD_VALUE).map(r => r._id);
    if (toUpdateIds.length === 0) {
      console.log('No allocations with value', OLD_VALUE, 'to update.');
      return;
    }

    const result = await AssetAllocation.updateMany({ _id: { $in: toUpdateIds } }, { $set: { totalValue: NEW_VALUE } });
    console.log(`Updated ${result.modifiedCount} of ${result.matchedCount} Real estate allocation(s) from ${OLD_VALUE} to ${NEW_VALUE}.`);
    return;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
