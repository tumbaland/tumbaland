import { Storage } from "@google-cloud/storage";
import fs from "fs";
import os from "os";
import path from "path";

// Configure Google Cloud Storage authentication
let storageConfig: any = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
};

// Method 1: Using base64-encoded service account key
if (process.env.GOOGLE_CLOUD_KEY_FILE_BASE64) {
  try {
    const decoded = Buffer.from(
      process.env.GOOGLE_CLOUD_KEY_FILE_BASE64,
      "base64"
    ).toString("utf-8");
    const tempPath = path.join(os.tmpdir(), `gcloud-key-${Date.now()}.json`);
    fs.writeFileSync(tempPath, decoded, { encoding: "utf-8" });
    storageConfig.keyFilename = tempPath;
    console.log(
      "Using Google Cloud key from base64 env var, written to:",
      tempPath
    );
  } catch (error) {
    console.error("Error decoding GOOGLE_CLOUD_KEY_FILE_BASE64:", error);
    throw new Error("Invalid base64 in GOOGLE_CLOUD_KEY_FILE_BASE64");
  }
}
// Method 2: Using service account key file
else if (process.env.GOOGLE_CLOUD_KEY_FILE) {
  storageConfig.keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
}
// Method 3: Using credentials from environment variable
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
// Method 4: Application Default Credentials (when running on Google Cloud)
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
