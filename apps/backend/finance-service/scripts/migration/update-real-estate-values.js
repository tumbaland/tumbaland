const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

const assetClassSchema = new mongoose.Schema(
  {
    name: String
  },
  { collection: 'assetclasses', versionKey: false }
);

const assetAllocationSchema = new mongoose.Schema(
  {
    assetClassId: String,
    totalValue: Number
  },
  { collection: 'assetallocations', versionKey: false }
);

const AssetClass = mongoose.model('FinanceServiceAssetClassMigration', assetClassSchema);
const AssetAllocation = mongoose.model('FinanceServiceAssetAllocationMigration', assetAllocationSchema);

async function run() {
  await mongoose.connect(mongoUri);

  try {
    const realEstateClasses = await AssetClass.find(
      { name: /^real estate$/i },
      { _id: 1 }
    ).lean();

    if (realEstateClasses.length === 0) {
      console.log('No asset classes named "Real estate" were found.');
      return;
    }

    const realEstateClassIds = realEstateClasses.map((assetClass) => assetClass._id.toString());

    const result = await AssetAllocation.updateMany(
      {
        assetClassId: { $in: realEstateClassIds },
        totalValue: 150000
      },
      {
        $set: {
          totalValue: 150000
        }
      }
    );

    console.log(
      `Updated ${result.modifiedCount} of ${result.matchedCount} matching Real estate allocation(s) from 100000 to 150000.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('Failed to update Real estate values:', error);
  process.exit(1);
});