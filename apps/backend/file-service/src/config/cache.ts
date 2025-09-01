import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { bucket } from './storage';

const CACHE_DIR = process.env.FILE_CACHE_DIR || path.join(process.cwd(), 'cache');
const CACHE_MAX_AGE = parseInt(process.env.CACHE_MAX_AGE || '864000000'); // 10 days in ms
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '1073741824'); // 1GB in bytes
const CLEANUP_INTERVAL = parseInt(process.env.CACHE_CLEANUP_INTERVAL || '259200000'); // 3 days in ms

// Track last cleanup time to throttle cleanup operations
let lastCleanupTime = 0;

// Ensure cache directory exists
export const ensureCacheDir = async (): Promise<void> => {
  try {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create cache directory:', error);
  }
};

// Get cache file path for a given file ID
const getCacheFilePath = (fileId: string): string => {
  return path.join(CACHE_DIR, fileId);
};

// Check if file exists in cache and is not expired
export const isCacheValid = async (fileId: string): Promise<boolean> => {
  try {
    const cacheFilePath = getCacheFilePath(fileId);
    const stats = await fsPromises.stat(cacheFilePath);
    const now = Date.now();
    const fileAge = now - stats.mtime.getTime();

    return fileAge < CACHE_MAX_AGE;
  } catch (error) {
    return false; // File doesn't exist or error occurred
  }
};

// Get file from cache
export const getFromCache = async (fileId: string): Promise<Buffer | null> => {
  try {
    const cacheFilePath = getCacheFilePath(fileId);

    if (await isCacheValid(fileId)) {
      return await fsPromises.readFile(cacheFilePath);
    }

    return null;
  } catch (error) {
    console.error(`Failed to read from cache for ${fileId}:`, error);
    return null;
  }
};

// Store file in cache
export const storeInCache = async (fileId: string, data: Buffer): Promise<void> => {
  try {
    await ensureCacheDir();
    const cacheFilePath = getCacheFilePath(fileId);
    await fsPromises.writeFile(cacheFilePath, data);

    // Clean up old cache files if needed (but not too frequently)
    const now = Date.now();
    if (now - lastCleanupTime > CLEANUP_INTERVAL) {
      lastCleanupTime = now;
      await cleanupCache();
    }
  } catch (error) {
    console.error(`Failed to store in cache for ${fileId}:`, error);
  }
};

// Download file from Google Cloud Storage and cache it
export const downloadAndCache = async (fileId: string): Promise<Buffer> => {
  try {
    const file = bucket.file(fileId);

    // Check if file exists in GCS
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('File not found in Google Cloud Storage');
    }

    // Download file from GCS
    const [buffer] = await file.download();

    // Store in cache
    await storeInCache(fileId, buffer);

    return buffer;
  } catch (error) {
    throw new Error(`Failed to download and cache file: ${(error as Error).message}`);
  }
};

// Get file (from cache or download if not cached)
export const getFileBuffer = async (fileId: string): Promise<Buffer> => {
  const startTime = Date.now();

  // Try to get from cache first
  const cachedFile = await getFromCache(fileId);
  if (cachedFile) {
    const duration = Date.now() - startTime;
    console.log(`Cache HIT for ${fileId} (${duration}ms)`);
    return cachedFile;
  }

  // If not in cache, download and cache
  console.log(`Cache MISS for ${fileId}, downloading...`);
  const buffer = await downloadAndCache(fileId);
  const duration = Date.now() - startTime;
  console.log(`Downloaded and cached ${fileId} (${duration}ms)`);
  return buffer;
};

// Clean up old cache files
const cleanupCache = async (): Promise<void> => {
  try {
    const files = await fsPromises.readdir(CACHE_DIR);
    let totalSize = 0;
    const fileStats: Array<{ name: string; path: string; stats: fs.Stats }> = [];

    // Get stats for all files
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const stats = await fsPromises.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          fileStats.push({ name: file, path: filePath, stats });
        }
      } catch (error) {
        console.error(`Error getting stats for ${filePath}:`, error);
      }
    }

    // If cache size exceeds limit, remove oldest files
    if (totalSize > CACHE_MAX_SIZE) {
      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());

      let removedSize = 0;
      const targetSize = CACHE_MAX_SIZE * 0.8; // Remove files until we're at 80% of max size

      for (const fileInfo of fileStats) {
        if (totalSize - removedSize <= targetSize) {
          break;
        }

        try {
          await fsPromises.unlink(fileInfo.path);
          removedSize += fileInfo.stats.size;
          console.log(`Removed cached file: ${fileInfo.name} (${fileInfo.stats.size} bytes)`);
        } catch (error) {
          console.error(`Failed to remove cached file ${fileInfo.path}:`, error);
        }
      }
    }

    // Remove expired files
    const now = Date.now();
    for (const fileInfo of fileStats) {
      const fileAge = now - fileInfo.stats.mtime.getTime();
      if (fileAge > CACHE_MAX_AGE) {
        try {
          await fsPromises.unlink(fileInfo.path);
          console.log(`Removed expired cached file: ${fileInfo.name}`);
        } catch (error) {
          console.error(`Failed to remove expired cached file ${fileInfo.path}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  }
};

// Remove file from cache
export const removeFromCache = async (fileId: string): Promise<void> => {
  try {
    const cacheFilePath = getCacheFilePath(fileId);
    await fsPromises.unlink(cacheFilePath);
  } catch (error) {
    // File might not exist in cache, which is fine
    console.log(`Cache file not found or already removed: ${fileId}`);
  }
};

// Get cache statistics
export const getCacheStats = async (): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile?: string;
  newestFile?: string;
}> => {
  try {
    const files = await fsPromises.readdir(CACHE_DIR);
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestFile = '';
    let newestFile = '';

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const stats = await fsPromises.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          const mtime = stats.mtime.getTime();

          if (mtime < oldestTime) {
            oldestTime = mtime;
            oldestFile = file;
          }

          if (mtime > newestTime) {
            newestTime = mtime;
            newestFile = file;
          }
        }
      } catch (error) {
        console.error(`Error getting stats for ${filePath}:`, error);
      }
    }

    return {
      totalFiles: files.length,
      totalSize,
      oldestFile: oldestFile || undefined,
      newestFile: newestFile || undefined
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { totalFiles: 0, totalSize: 0 };
  }
};
