import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { logger } from '@tumbaland/backend-core';

const DATA_DIR = (): string => process.env.FILE_SERVICE_DATA_DIR || '/data';

/**
 * Resolve the absolute path for a fileId.
 * fileId is already a path like "groupId/albumId/fileId/original.jpg"
 */
export const resolvePath = (fileId: string): string => {
  // Sanitise: prevent path traversal
  const normalised = path.normalize(fileId).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.resolve(DATA_DIR(), normalised.replace(/^[/\\]+/, ''));
};

/**
 * Ensure the directory for a file path exists.
 */
export const ensureDir = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * Write a buffer to disk.
 */
export const writeFile = (fileId: string, buffer: Buffer): void => {
  const filePath = resolvePath(fileId);
  ensureDir(filePath);
  fs.writeFileSync(filePath, buffer);
  logger.info(`File written: ${fileId}`, { size: buffer.length });
};

/** Thrown by `writeStream` when a body runs past its limit. */
export class TooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Upload exceeds ${maxBytes} bytes`);
  }
}

/**
 * Writes a request body to disk as it arrives, and returns its size.
 *
 * Never holds the whole file in memory, so one large video cannot take the
 * service down. Written to a temporary name and renamed into place, so a
 * dropped connection or an oversized body leaves the previous file (if any)
 * rather than a truncated one.
 */
export const writeStream = async (fileId: string, source: Readable, maxBytes = Infinity): Promise<number> => {
  const filePath = resolvePath(fileId);
  ensureDir(filePath);
  const partial = `${filePath}.${crypto.randomBytes(6).toString('hex')}.part`;

  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) callback(new TooLargeError(maxBytes));
      else callback(null, chunk);
    }
  });

  // The source is piped in rather than handed to `pipeline`, which would
  // destroy it on error. For a request that means destroying its socket before
  // the 413 can be sent, and the request logger then reads a socket that is no
  // longer there. Left alone, the unread rest is dropped when the response
  // closes the connection.
  const written = pipeline(counter, fs.createWriteStream(partial));
  source.on('error', (error) => counter.destroy(error));
  source.pipe(counter);

  try {
    await written;
    fs.renameSync(partial, filePath);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    throw error;
  }
  logger.info(`File written: ${fileId}`, { size });
  return size;
};

/**
 * Read a file from disk and return a Buffer.
 */
export const readFile = (fileId: string): Buffer => {
  const filePath = resolvePath(fileId);
  return fs.readFileSync(filePath);
};

/**
 * Check if a file exists.
 */
export const fileExists = (fileId: string): boolean => {
  try {
    fs.statSync(resolvePath(fileId));
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file metadata.
 */
export const getMetadata = (fileId: string): { size: number; lastModified: Date } => {
  const stat = fs.statSync(resolvePath(fileId));
  return { size: stat.size, lastModified: stat.mtime };
};

/**
 * Delete a single file.
 */
export const deleteFile = (fileId: string): void => {
  const filePath = resolvePath(fileId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info(`File deleted: ${fileId}`);
  }
};

/**
 * Delete all files whose relative path starts with prefix (folder delete).
 */
export const deleteByPrefix = (prefix: string): number => {
  const base = path.join(DATA_DIR(), path.normalize(prefix).replace(/^(\.\.(\/|\\|$))+/, ''));
  let count = 0;

  const removeDir = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removeDir(full);
      } else {
        fs.unlinkSync(full);
        count++;
      }
    }
    // Remove the now-empty directory
    try { fs.rmdirSync(dir); } catch { /* ignore non-empty */ }
  };

  // If prefix points to a directory, remove the whole subtree.
  // If it points to a file prefix (no trailing slash), remove matching files.
  const stat = fs.existsSync(base) ? fs.statSync(base) : null;
  if (stat?.isDirectory()) {
    removeDir(base);
  } else {
    // Treat as filename prefix — walk parent dir and delete matches
    const parentDir = path.dirname(base);
    const filePrefix = path.basename(base);
    if (fs.existsSync(parentDir)) {
      for (const name of fs.readdirSync(parentDir)) {
        if (name.startsWith(filePrefix)) {
          fs.unlinkSync(path.join(parentDir, name));
          count++;
        }
      }
    }
  }

  logger.info(`Deleted ${count} file(s) under prefix: ${prefix}`);
  return count;
};

/**
 * List all files under an optional prefix, up to maxKeys.
 */
export const listFiles = (prefix?: string, maxKeys = 1000): Array<{ name: string; size: number }> => {
  const baseDir = prefix
    ? path.join(DATA_DIR(), path.normalize(prefix).replace(/^(\.\.(\/|\\|$))+/, ''))
    : DATA_DIR();

  const results: Array<{ name: string; size: number }> = [];

  const walk = (dir: string): void => {
    if (results.length >= maxKeys || !fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxKeys) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const relative = path.relative(DATA_DIR(), full);
        results.push({ name: relative, size: fs.statSync(full).size });
      }
    }
  };

  walk(baseDir);
  return results;
};
