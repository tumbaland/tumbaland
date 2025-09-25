import { generateFileName } from '../config/multer';
import { FileUploadData, FileDownloadData, FileDeleteResult, FileMetadata } from '../types';
import * as localStorage from '../config/localStorage';
import { getFilePath } from '../config/localStorage';
import * as signedUrlService from './signedUrlService';
import axios from 'axios';
import { promises as fsPromises } from 'fs';

// Get metadata from album service (MongoDB)
const getMetadataFromAlbumService = async (fileId: string): Promise<any> => {
  try {
    const ALBUM_API_URL = process.env.ALBUM_API_URL;
    const response = await axios.get(`${ALBUM_API_URL}/api/photos/by-file/${fileId}`);
    return response.data.data;
  } catch (error) {
    // If album service is unavailable or photo not found, return null
    console.warn(`Album service unavailable or photo not found for ${fileId}`);
    return null;
  }
};

// Upload file to local storage (no metadata stored - gets from album service)
export const uploadFile = async (file: Express.Multer.File): Promise<FileUploadData> => {
  try {
    const fileName = generateFileName(file.originalname);

    // Save file to local storage without any metadata
    await localStorage.saveFileOnly(fileName, file.buffer);

    // Generate signed URL for secure access
    const signedUrl = signedUrlService.generateFileAccessUrl(fileName, 'read', 60);

    const fileData: FileUploadData = {
      id: fileName,
      name: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: signedUrl,
      uploadedAt: new Date().toISOString()
    };

    return fileData;
  } catch (error) {
    throw new Error(`Failed to upload file: ${(error as Error).message}`);
  }
};

// Download file from local storage (get metadata from album service)
export const downloadFile = async (fileId: string): Promise<FileDownloadData> => {
  try {
    const filePath = getFilePath(fileId);

    // Read file
    const buffer = await fsPromises.readFile(filePath);

    // Create readable stream from buffer
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    // Get content type from album service
    const albumMetadata = await getMetadataFromAlbumService(fileId);
    const contentType = albumMetadata?.mimetype || 'application/octet-stream';
    const originalName = albumMetadata?.originalName || fileId;

    return {
      stream,
      metadata: {
        contentType,
        size: buffer.length,
        name: originalName
      }
    };
  } catch (error) {
    throw new Error(`Failed to download file: ${(error as Error).message}`);
  }
};

// Delete file from local storage
export const deleteFile = async (fileId: string): Promise<FileDeleteResult> => {
  try {
    await localStorage.deleteFile(fileId);

    return {
      message: 'File deleted successfully',
      fileId,
      deletedAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to delete file: ${(error as Error).message}`);
  }
};

// Get file metadata from album service (MongoDB only)
export const getFileMetadata = async (fileId: string): Promise<FileMetadata> => {
  try {
    // Get metadata from album service (MongoDB)
    const albumMetadata = await getMetadataFromAlbumService(fileId);
    if (!albumMetadata) {
      throw new Error('File not found');
    }

    // Generate signed URL for secure access
    const signedUrl = signedUrlService.generateFileAccessUrl(fileId, 'read', 60);
    return {
      id: fileId,
      name: albumMetadata.originalName,
      size: albumMetadata.size,
      contentType: albumMetadata.mimetype,
      created: albumMetadata.createdAt,
      updated: albumMetadata.updatedAt,
      url: signedUrl
    };
  } catch (error) {
    throw new Error(`Failed to get file metadata: ${(error as Error).message}`);
  }
};

// List all files - get from album service (single source of truth)
export const listFiles = async (prefix: string = '', limit: number = 100): Promise<FileMetadata[]> => {
  try {
    // Get all photos from album service
    const ALBUM_API_URL = process.env.ALBUM_API_URL;
    const response = await axios.get(`${ALBUM_API_URL}/api/photos?limit=${limit}`);
    const photos = response.data.data?.photos || [];

    // Filter by prefix if provided
    const filteredPhotos = prefix
      ? photos.filter((photo: any) => photo.fileId.startsWith(prefix))
      : photos;

    // Generate signed URLs for each photo
    const fileList: FileMetadata[] = filteredPhotos.slice(0, limit).map((photo: any) => {
      const signedUrl = signedUrlService.generateFileAccessUrl(photo.fileId, 'read', 60);
      return {
        id: photo.fileId,
        name: photo.originalName,
        size: photo.size,
        contentType: photo.mimetype,
        created: photo.createdAt,
        updated: photo.updatedAt,
        url: signedUrl
      };
    });

    return fileList;
  } catch (error) {
    console.warn('Album service unavailable for file listing, returning empty list');
    return [];
  }
};

// Generate signed URL for secure file access (using our custom implementation)
export const getSignedUrl = async (fileId: string, expirationMinutes: number = 60): Promise<string> => {
  try {
    // Check if file exists by querying album service
    const albumMetadata = await getMetadataFromAlbumService(fileId);
    if (!albumMetadata) {
      throw new Error('File not found');
    }

    return signedUrlService.generateFileAccessUrl(fileId, 'read', expirationMinutes);
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
  }
};

// Generate upload signed URL for direct upload from client (using our custom implementation)
export const getUploadSignedUrl = async (
  fileName: string,
  contentType: string,
  expirationMinutes: number = 15
): Promise<string> => {
  try {
    return signedUrlService.generateUploadUrl(fileName, contentType, expirationMinutes);
  } catch (error) {
    throw new Error(`Failed to generate upload signed URL: ${(error as Error).message}`);
  }
};
