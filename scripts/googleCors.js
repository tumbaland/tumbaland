// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');

// Creates a client - this will use the service account credentials from the file-service
const storage = new Storage({
  projectId: 'tumbaland', // Replace with your actual project ID
  keyFilename: './apps/backend/file-service/credentials/tumbabucket.json' // Path to your service account key
});

const bucketName = 'tumbabucket';

async function setCorsConfiguration() {
  try {
    console.log(`Setting CORS configuration for bucket: ${bucketName}`);
    
    const corsConfiguration = [
      {
        origin: [
          'http://localhost:3000', 
          'http://localhost:3001', 
          'http://localhost:3002',
          'http://localhost:3003'
        ],
        method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
        responseHeader: [
          'Content-Type', 
          'Access-Control-Allow-Origin', 
          'Access-Control-Allow-Methods', 
          'Access-Control-Allow-Headers',
          'Authorization',
          'X-Requested-With'
        ],
        maxAgeSeconds: 3600
      }
    ];

    // Set CORS configuration
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    
    console.log(`CORS configuration set successfully for bucket: ${bucketName}`);
    
    // Verify the configuration
    const [metadata] = await storage.bucket(bucketName).getMetadata();
    console.log('Current CORS configuration:');
    console.log(JSON.stringify(metadata.cors, null, 2));
    
  } catch (error) {
    console.error('Error setting CORS configuration:', error);
  }
}

async function getBucketMetadata() {
  try {
    // Get Bucket Metadata
    const [metadata] = await storage.bucket(bucketName).getMetadata();
    
    console.log('Bucket metadata:');
    console.log(JSON.stringify(metadata, null, 2));
    
    if (metadata.cors) {
      console.log('\nCurrent CORS configuration:');
      console.log(JSON.stringify(metadata.cors, null, 2));
    } else {
      console.log('\nNo CORS configuration found.');
    }
  } catch (error) {
    console.error('Error getting bucket metadata:', error);
  }
}

// Run the CORS configuration setup
setCorsConfiguration();