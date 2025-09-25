import { Request, Response, NextFunction } from 'express';
import * as fileService from '../services/fileService';
import { generateFileName } from '../config/multer';
import * as localStorage from '../config/localStorage';
import Joi from 'joi';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import {
  ListFilesQuery,
  ApiError,
  UploadResponse,
  SignedUrlResponse,
  UploadSignedUrlResponse,
  FileMetadataResponse,
  ListFilesResponseWrapper,
  DeleteFileResponse
} from '../types';

// Validation schemas
const fileIdSchema = Joi.string().required();
const listFilesSchema = Joi.object({
  prefix: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).optional()
});

// Upload file controller
export const uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: {
          message: 'No file provided',
          status: 400
        }
      } as ApiError);
      return;
    }
    const uploadedFile = await fileService.uploadFile(req.file);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: uploadedFile
    } as UploadResponse);
  } catch (error) {
    next(error);
  }
};

// Download file controller
export const downloadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }

    const { stream, metadata } = await fileService.downloadFile(req.params.fileId);

    res.set({
      'Content-Type': metadata.contentType || 'application/octet-stream',
      'Content-Length': metadata.size.toString(),
      'Content-Disposition': `attachment; filename="${metadata.name}"`
    });

    stream.pipe(res);
  } catch (error) {
    if ((error as Error).message.includes('File not found')) {
      res.status(404).json({
        error: {
          message: 'File not found',
          status: 404
        }
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Delete file controller
export const deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }
    const result = await fileService.deleteFile(req.params.fileId);

    res.status(200).json({
      success: true,
      data: result
    } as DeleteFileResponse);
  } catch (error) {
    if ((error as Error).message.includes('File not found')) {
      res.status(404).json({
        error: {
          message: 'File not found',
          status: 404
        }
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Get file metadata controller
export const getFileMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }
    const metadata = await fileService.getFileMetadata(req.params.fileId);

    res.status(200).json({
      success: true,
      data: metadata
    } as FileMetadataResponse);
  } catch (error) {
    if ((error as Error).message.includes('File not found')) {
      res.status(404).json({
        error: {
          message: 'File not found',
          status: 404
        }
      } as ApiError);
      return;
    }
    next(error);
  }
};

// List files controller
export const listFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = listFilesSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }
    const { prefix, limit } = req.query as ListFilesQuery;
    const files = await fileService.listFiles(prefix, limit);

    res.status(200).json({
      success: true,
      data: {
        files,
        count: files.length
      }
    } as ListFilesResponseWrapper);
  } catch (error) {
    next(error);
  }
};

// Get signed URL controller (for secure file access)
export const getSignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }

    const expirationMinutes = parseInt(req.query.expires as string) || 60;
    if (expirationMinutes < 1 || expirationMinutes > 1440) {
      // Max 24 hours
      res.status(400).json({
        error: {
          message: 'Expiration must be between 1 and 1440 minutes (24 hours)',
          status: 400
        }
      } as ApiError);
      return;
    }

    const signedUrl = await fileService.getSignedUrl(req.params.fileId, expirationMinutes);
    res.status(200).json({
      success: true,
      data: {
        signedUrl,
        fileId: req.params.fileId,
        expiresInMinutes: expirationMinutes,
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString()
      }
    } as SignedUrlResponse);
  } catch (error) {
    if ((error as Error).message.includes('File not found')) {
      res.status(404).json({
        error: {
          message: 'File not found',
          status: 404
        }
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Get upload signed URL controller (for direct client uploads)
export const getUploadSignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const uploadSignedUrlSchema = Joi.object({
      fileName: Joi.string().required(),
      contentType: Joi.string().required(),
      expirationMinutes: Joi.number().integer().min(1).max(60).optional()
    });

    const { error } = uploadSignedUrlSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }
    const { fileName, contentType, expirationMinutes = 15 } = req.body;

    // Generate unique filename for upload
    const uniqueFileName = generateFileName(fileName);

    const signedUrl = await fileService.getUploadSignedUrl(uniqueFileName, contentType, expirationMinutes);
    res.status(200).json({
      success: true,
      data: {
        uploadUrl: signedUrl,
        fileName: uniqueFileName,
        contentType,
        expiresInMinutes: expirationMinutes,
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString()
      }
    } as UploadSignedUrlResponse);
  } catch (error) {
    next(error);
  }
};

// Serve file directly (from storage)
export const serveFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400
        }
      } as ApiError);
      return;
    }

    const fileId = req.params.fileId;

    // Get file directly from storage (no metadata JSON)
    const filePath = localStorage.getFilePath(fileId);
    const buffer = await fsPromises.readFile(filePath);

    // Get metadata from album service
    const metadata = await fileService.getFileMetadata(fileId);

    // Set appropriate headers
    res.set({
      'Content-Type': metadata.contentType || 'application/octet-stream',
      'Content-Length': metadata.size?.toString() || buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      ETag: `"${fileId}"`,
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    // Check if client has cached version
    if (req.headers['if-none-match'] === `"${fileId}"`) {
      res.status(304).end();
      return;
    }

    res.send(buffer);
  } catch (error) {
    if ((error as Error).message.includes('File not found')) {
      res.status(404).json({
        error: {
          message: 'File not found',
          status: 404
        }
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Direct upload with signed URL (for client direct uploads) - raw file data
export const directUploadRaw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fileId } = req.params;
    const fileAccess = (req as any).fileAccess;

    // Verify the token allows write access
    if (fileAccess.action !== 'write') {
      res.status(403).json({
        error: {
          message: 'Token does not allow write access',
          status: 403
        }
      } as ApiError);
      return;
    }

    // Verify fileId matches token
    if (fileAccess.fileId !== fileId) {
      res.status(403).json({
        error: {
          message: 'Token fileId does not match requested file',
          status: 403
        }
      } as ApiError);
      return;
    }

    // Get raw file data from request body
    const fileBuffer = req.body;
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      res.status(400).json({
        error: {
          message: 'No file data provided',
          status: 400
        }
      } as ApiError);
      return;
    }

    // Get content type from headers
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    // Save file directly to local storage (no metadata)
    await localStorage.saveFileOnly(fileId, fileBuffer);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: fileId,
        name: fileId,
        size: fileBuffer.length,
        mimetype: contentType,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
