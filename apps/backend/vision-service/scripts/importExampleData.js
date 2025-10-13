#!/usr/bin/env node

/**
 * Import Example Data Script
 * 
 * This script imports example data from the example/ directory into the vision service database.
 * It demonstrates how to use the API to create datasets, trainings, and epochs.
 * 
 * Usage: node scripts/importExampleData.js [API_URL]
 * Example: node scripts/importExampleData.js http://localhost:4010/api
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.argv[2] || 'http://localhost:4010/api';

async function importDataset(filePath, datasetName) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const response = await fetch(`${API_URL}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: data.uuid,
        name: datasetName,
        description: `${datasetName} analysis`,
        timestamp: data.timestamp,
        dataset_info: data.dataset_info,
        annotations: data.annotations,
        camera: data.camera,
        lidar: data.lidar
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`✓ Dataset "${datasetName}" imported successfully`);
      return result.data;
    } else {
      console.error(`✗ Failed to import dataset "${datasetName}":`, result.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error importing dataset "${datasetName}":`, error.message);
    return null;
  }
}

async function importTrainingConfig(filePath, configName, datasetId) {
  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const response = await fetch(`${API_URL}/trainings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Training: ${configName}`,
        description: config.Summary || `Training configuration from ${configName}`,
        datasetId: datasetId,
        configuration: config,
        status: 'completed'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`✓ Training config "${configName}" imported successfully`);
      return result.data;
    } else {
      console.error(`✗ Failed to import training config "${configName}":`, result.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error importing training config "${configName}":`, error.message);
    return null;
  }
}

async function importEpoch(filePath, trainingId, trainingUuid) {
  try {
    const epochData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const response = await fetch(`${API_URL}/epochs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainingId: trainingId,
        training_uuid: trainingUuid,
        epoch_uuid: epochData.epoch_uuid,
        epoch: epochData.epoch,
        timestamp: epochData.timestamp,
        results: epochData.results,
        learning_rate: epochData.learning_rate,
        epoch_time: epochData.epoch_time
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✓ Epoch ${epochData.epoch} imported successfully`);
      return result.data;
    } else {
      console.error(`✗ Failed to import epoch ${epochData.epoch}:`, result.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error importing epoch:`, error.message);
    return null;
  }
}

// Create or get training by UUID
async function getOrCreateTraining(trainingUuid, datasetId) {
  try {
    // First try to find existing training by UUID
    const findResponse = await fetch(`${API_URL}/trainings/uuid/${trainingUuid}`);
    const findResult = await findResponse.json();

    if (findResult.success && findResult.data) {
      console.log(`✓ Found existing training with UUID: ${trainingUuid}`);
      return findResult.data;
    }

    // If not found, create new training
    console.log(`Creating new training with UUID: ${trainingUuid}`);

    const createResponse = await fetch(`${API_URL}/trainings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: trainingUuid,
        name: `Training ${trainingUuid.slice(0, 8)}`,
        description: `Training imported from epoch data`,
        datasetId: datasetId,
        configuration: { note: 'Configuration from epoch data' },
        status: 'completed'
      })
    });

    const createResult = await createResponse.json();

    if (createResult.success) {
      console.log(`✓ Created new training with UUID: ${trainingUuid}`);
      return createResult.data;
    } else {
      console.error(`✗ Failed to create training:`, createResult.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error getting/creating training:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting example data import...\n');
  console.log(`API URL: ${API_URL}\n`);

  // Create a default dataset for epochs if none exists
  let defaultDataset = null;
  try {
    console.log('=== Checking/Creating Default Dataset ===');
    const datasetsResponse = await fetch(`${API_URL}/datasets`);
    const datasetsResult = await datasetsResponse.json();

    if (datasetsResult.success && datasetsResult.data.datasets && datasetsResult.data.datasets.length > 0) {
      defaultDataset = datasetsResult.data.datasets[0];
      console.log(`✓ Using existing dataset: ${defaultDataset.name}`);
    } else {
      // Create a default dataset
      const createDatasetResponse = await fetch(`${API_URL}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: 'default-dataset-uuid',
          name: 'Default Dataset',
          description: 'Default dataset for epoch imports',
          timestamp: new Date().toISOString(),
          dataset_info: { note: 'Created for epoch import' },
          annotations: [],
          camera: { note: 'Default camera config' },
          lidar: { note: 'Default lidar config' }
        })
      });

      const createResult = await createDatasetResponse.json();
      if (createResult.success) {
        defaultDataset = createResult.data;
        console.log(`✓ Created default dataset: ${defaultDataset.name}`);
      }
    }
  } catch (error) {
    console.error('✗ Error with dataset setup:', error.message);
  }

  console.log('');

  // Import epochs
  console.log('=== Importing Epochs ===');

  const epochsDir = path.join(__dirname, 'epoch');
  if (fs.existsSync(epochsDir) && defaultDataset) {
    const epochFiles = fs.readdirSync(epochsDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        // Sort by epoch number
        const epochA = parseInt(a.split('_')[1]);
        const epochB = parseInt(b.split('_')[1]);
        return epochA - epochB;
      });

    console.log(`Found ${epochFiles.length} epoch files`);

    // Group epochs by training UUID
    const epochsByTraining = {};
    for (const epochFile of epochFiles) {
      const epochData = JSON.parse(
        fs.readFileSync(path.join(epochsDir, epochFile), 'utf8')
      );
      const trainingUuid = epochData.training_uuid;

      if (!epochsByTraining[trainingUuid]) {
        epochsByTraining[trainingUuid] = [];
      }
      epochsByTraining[trainingUuid].push({
        file: epochFile,
        data: epochData
      });
    }

    console.log(`Found ${Object.keys(epochsByTraining).length} unique training UUIDs`);

    // Import epochs for each training
    for (const [trainingUuid, epochs] of Object.entries(epochsByTraining)) {
      console.log(`\n--- Processing training ${trainingUuid} (${epochs.length} epochs) ---`);

      // Get or create training
      const training = await getOrCreateTraining(trainingUuid, defaultDataset._id);
      if (!training) {
        console.error(`Skipping epochs for training ${trainingUuid}`);
        continue;
      }

      // Import all epochs for this training
      for (const epochInfo of epochs) {
        await importEpoch(
          path.join(epochsDir, epochInfo.file),
          training._id,
          training.uuid
        );
      }
    }
  } else {
    console.log('Epochs directory not found or no dataset available');
  }

  console.log('\n=== Import Complete ===');
  console.log('You can now access the data through the API');
  console.log(`- Datasets: ${API_URL}/datasets`);
  console.log(`- Trainings: ${API_URL}/trainings`);
  console.log(`- Epochs: ${API_URL}/epochs`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
