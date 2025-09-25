#!/usr/bin/env node

// Script to download all files from Google Cloud Storage bucket to local folder
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const projectId = 'tumbaland';
const bucketName = 'tumbabucket';
const keyFilename = './apps/backend/file-service/credentials/tumbabucket.json';
const downloadDir = process.argv[2] || './apps/backend/file-service/storage'; // Default to file-service storage folder

// Check if credentials file exists, otherwise create from base64 env var
let credentialsPath = keyFilename;
if (!fs.existsSync(keyFilename)) {
  console.log('Service account JSON file not found, checking for base64 environment variable...');
  const base64Key = process.env.GOOGLE_CLOUD_KEY_FILE_BASE64;
  if (base64Key) {
    // Create credentials directory if it doesn't exist
    const credentialsDir = path.dirname(keyFilename);
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }

    // Decode base64 and write to file
    const jsonData = Buffer.from(base64Key, 'base64');
    fs.writeFileSync(keyFilename, jsonData);
    console.log('Created credentials file from base64 environment variable');
  } else {
    console.error('Neither credentials file nor GOOGLE_CLOUD_KEY_FILE_BASE64 environment variable found');
    process.exit(1);
  }
}

// Creates a client
const storage = new Storage({
  projectId,
  keyFilename: credentialsPath
});

const bucket = storage.bucket(bucketName);

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Download a single file from GCS
 */
async function downloadFile(file) {
  const fileName = file.name;
  const localFilePath = path.join(downloadDir, fileName);

  // Ensure the directory exists
  const dirPath = path.dirname(localFilePath);
  ensureDirectoryExists(dirPath);

  try {
    console.log(`Downloading: ${fileName}`);
    await bucket.file(fileName).download({ destination: localFilePath });
    console.log(`✓ Downloaded: ${fileName} -> ${localFilePath}`);
  } catch (error) {
    console.error(`✗ Failed to download ${fileName}:`, error.message);
  }
}

/**
 * Get all files in the bucket and download them
 */
async function downloadAllFiles() {
  try {
    console.log(`Starting download of all files from bucket: ${bucketName}`);
    console.log(`Download directory: ${downloadDir}`);
    console.log('=' .repeat(50));

    // Ensure download directory exists
    ensureDirectoryExists(downloadDir);

    // Get all files in the bucket
    const [files] = await bucket.getFiles();

    if (files.length === 0) {
      console.log('No files found in the bucket.');
      return;
    }

    console.log(`Found ${files.length} files to download.`);

    // Download files sequentially to avoid overwhelming the system
    for (const file of files) {
      await downloadFile(file);
    }

    console.log('=' .repeat(50));
    console.log(`Download complete! ${files.length} files processed.`);

  } catch (error) {
    console.error('Error downloading files:', error);
    process.exit(1);
  }
}

/**
 * Get bucket statistics
 */
async function getBucketStats() {
  try {
    const [files] = await bucket.getFiles();
    const [metadata] = await bucket.getMetadata();

    console.log(`Bucket: ${bucketName}`);
    console.log(`Location: ${metadata.location}`);
    console.log(`Storage class: ${metadata.storageClass}`);
    console.log(`Total files: ${files.length}`);

    let totalSize = 0;
    files.forEach(file => {
      totalSize += parseInt(file.metadata.size || 0);
    });

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    console.log(`Total size: ${totalSizeMB} MB`);

  } catch (error) {
    console.error('Error getting bucket stats:', error);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];

  if (command === '--stats' || command === '-s') {
    await getBucketStats();
  } else {
    // If first argument is not a command, treat it as download directory
    await downloadAllFiles();
  }
}

main().catch(console.error);