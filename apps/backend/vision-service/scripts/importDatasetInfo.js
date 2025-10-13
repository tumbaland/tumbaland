#!/usr/bin/env node

/**
 * Import Dataset Info Script
 *
 * This script imports dataset information files from the dataset/ directory and attaches them to trainings.
 *
 * Usage: node scripts/importDatasetInfo.js [API_URL] [TRAINING_ID]
 * Example: node scripts/importDatasetInfo.js http://localhost:4010/api 68ecbc993fe4f016cc2844f8
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.argv[2] || 'http://localhost:4010/api';

async function importDatasetInfo(filePath, fileName, trainingId) {
  try {
    const datasetInfo = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          dataset_info: datasetInfo
        }
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✓ Dataset info "${fileName}" imported successfully to training ${trainingId}`);
      console.log(`  Dataset: ${datasetInfo.dataset_overview?.name || 'Unknown dataset'}`);
      console.log(`  Total frames: ${datasetInfo.dataset_overview?.total_frames || 'Unknown'}`);
      console.log(`  Classes: ${Object.keys(datasetInfo.dataset_overview?.classes || {}).length}`);
      return result.data;
    } else {
      console.error(`✗ Failed to import dataset info "${fileName}":`, result.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error importing dataset info "${fileName}":`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting dataset info import...\n');
  console.log(`API URL: ${API_URL}\n`);

  // Get training ID from command line or use default
  const trainingId = process.argv[3] || '68ecef71a8d2cf235811e495';
  console.log(`Target Training ID: ${trainingId}\n`);

  // Import dataset info
  console.log('=== Importing Dataset Info ===');

  const datasetDir = path.join(__dirname, 'dataset');
  if (fs.existsSync(datasetDir)) {
    const datasetFiles = fs.readdirSync(datasetDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    console.log(`Found ${datasetFiles.length} dataset info files`);

    // Import all dataset info files to the specified training
    for (const datasetFile of datasetFiles) {
      const fileName = path.parse(datasetFile).name;
      await importDatasetInfo(
        path.join(datasetDir, datasetFile),
        fileName,
        trainingId
      );
    }
  } else {
    console.log('Dataset directory not found');
  }

  console.log('\n=== Import Complete ===');
  console.log('You can now access the updated training through the API');
  console.log(`- Training: ${API_URL}/trainings/${trainingId}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});