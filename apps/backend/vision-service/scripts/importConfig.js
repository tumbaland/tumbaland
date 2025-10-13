#!/usr/bin/env node

/**
 * Import Config Script
 *
 * This script imports configuration files from the config/ directory and attaches them to trainings.
 *
 * Usage: node scripts/importConfig.js [API_URL]
 * Example: node scripts/importConfig.js http://localhost:4010/api
 */

const fs = require('fs');
const path = require('path');

const API_URL = process.argv[2] || 'http://localhost:4010/api';

async function importConfig(filePath, configName, trainingId) {
  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const response = await fetch(`${API_URL}/trainings/${trainingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configuration: config
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✓ Config "${configName}" imported successfully to training ${trainingId}`);
      console.log(`  Summary: ${config.Summary || 'No summary available'}`);
      return result.data;
    } else {
      console.error(`✗ Failed to import config "${configName}":`, result.message);
      return null;
    }
  } catch (error) {
    console.error(`✗ Error importing config "${configName}":`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting config import...\n');
  console.log(`API URL: ${API_URL}\n`);

  // Get training ID from command line or use default
  const trainingId = process.argv[3] || '68ecef71a8d2cf235811e495';
  console.log(`Target Training ID: ${trainingId}\n`);

  // Import configs
  console.log('=== Importing Configs ===');

  const configsDir = path.join(__dirname, 'config');
  if (fs.existsSync(configsDir)) {
    const configFiles = fs.readdirSync(configsDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    console.log(`Found ${configFiles.length} config files`);

    // Import all configs to the specified training
    for (const configFile of configFiles) {
      const configName = path.parse(configFile).name;
      await importConfig(
        path.join(configsDir, configFile),
        configName,
        trainingId
      );
    }
  } else {
    console.log('Config directory not found');
  }

  console.log('\n=== Import Complete ===');
  console.log('You can now access the updated training through the API');
  console.log(`- Training: ${API_URL}/trainings/${trainingId}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});