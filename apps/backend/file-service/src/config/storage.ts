import { Storage } from "@google-cloud/storage";

// Configure Google Cloud Storage authentication
let storageConfig: any = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
};

// Method 1: Using service account key file
if (process.env.GOOGLE_CLOUD_KEY_FILE) {
  storageConfig.keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
}
// Method 2: Using credentials from environment variable
else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    storageConfig.credentials = credentials;
  } catch (error) {
    console.error("Error parsing GOOGLE_CLOUD_CREDENTIALS:", error);
    throw new Error(
      "Invalid GOOGLE_CLOUD_CREDENTIALS format. Must be valid JSON."
    );
  }
}
// Method 3: Application Default Credentials (when running on Google Cloud)
else {
  console.log(
    "Using Application Default Credentials (good for Google Cloud deployment)"
  );
}

// Initialize Google Cloud Storage
const storage = new Storage(storageConfig);

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

if (!bucketName) {
  throw new Error("GOOGLE_CLOUD_BUCKET_NAME environment variable is required");
}

if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
  throw new Error("GOOGLE_CLOUD_PROJECT_ID environment variable is required");
}

// Test the storage configuration
const testStorageConnection = async () => {
  try {
    const bucket = storage.bucket(bucketName);
    await bucket.getMetadata();
    console.log(
      `✅ Successfully connected to Google Cloud Storage bucket: ${bucketName}`
    );
  } catch (error: any) {
    console.error("❌ Google Cloud Storage connection failed:");
    console.error("Error:", error.message);

    if (error.code === "ENOENT") {
      console.error(
        "💡 Tip: Check if your service account key file exists at the specified path"
      );
    } else if (error.code === 403) {
      console.error(
        "💡 Tip: Check if your service account has the correct permissions"
      );
    } else if (error.code === 404) {
      console.error("💡 Tip: Check if the bucket name is correct and exists");
    }

    throw error;
  }
};

// Test connection on startup (optional - comment out if you don't want this check)
if (process.env.NODE_ENV !== "test") {
  testStorageConnection().catch(console.error);
}

const bucket = storage.bucket(bucketName);

export { storage, bucket, bucketName };
