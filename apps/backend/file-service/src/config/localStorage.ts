import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Local storage configuration
const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/storage' : path.join(__dirname, '../../storage');

// Ensure storage directory exists
export const ensureStorageDirs = async (): Promise<void> => {
  try {
    await fsPromises.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create storage directory:', error);
    throw error;
  }
};

// Get file path for a given file ID
export const getFilePath = (fileId: string): string => {
  return path.join(STORAGE_DIR, fileId);
};

// Save file to local storage (physical files only)
export const saveFileOnly = async (fileId: string, buffer: Buffer): Promise<void> => {
  try {
    await ensureStorageDirs();

    // Write file
    const filePath = getFilePath(fileId);
    await fsPromises.writeFile(filePath, buffer);

  } catch (error) {
    console.error(`Failed to save file ${fileId}:`, error);
    throw error;
  }
};

// Delete file from local storage
export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    const filePath = getFilePath(fileId);

    // Delete the physical file
    await fsPromises.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

  } catch (error) {
    console.error(`Failed to delete file ${fileId}:`, error);
    throw error;
  }
};

// Check if file exists
export const fileExists = async (fileId: string): Promise<boolean> => {
  try {
    const filePath = getFilePath(fileId);
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
};