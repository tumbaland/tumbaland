import { Request, Response, NextFunction } from "express";
import * as fileService from "../services/fileService";
import * as cacheService from "../config/cache";
import Joi from "joi";
import {
  ListFilesQuery,
  ApiError,
  UploadResponse,
  SignedUrlResponse,
  UploadSignedUrlResponse,
  FileMetadataResponse,
  ListFilesResponseWrapper,
  DeleteFileResponse,
} from "../types";

// Validation schemas
const fileIdSchema = Joi.string().required();
const listFilesSchema = Joi.object({
  prefix: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(1000).optional(),
});

// Upload file controller
export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: {
          message: "No file provided",
          status: 400,
        },
      } as ApiError);
      return;
    }
    const uploadedFile = await fileService.uploadFile(req.file);

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: uploadedFile,
    } as UploadResponse);
  } catch (error) {
    next(error);
  }
};

// Download file controller
export const downloadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }

    const { stream, metadata } = await fileService.downloadFile(
      req.params.fileId
    );

    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Length": metadata.size.toString(),
      "Content-Disposition": `attachment; filename="${metadata.name}"`,
    });

    stream.pipe(res);
  } catch (error) {
    if ((error as Error).message.includes("File not found")) {
      res.status(404).json({
        error: {
          message: "File not found",
          status: 404,
        },
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Delete file controller
export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }
    const result = await fileService.deleteFile(req.params.fileId);

    res.status(200).json({
      success: true,
      data: result,
    } as DeleteFileResponse);
  } catch (error) {
    if ((error as Error).message.includes("File not found")) {
      res.status(404).json({
        error: {
          message: "File not found",
          status: 404,
        },
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Get file metadata controller
export const getFileMetadata = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }
    const metadata = await fileService.getFileMetadata(req.params.fileId);

    res.status(200).json({
      success: true,
      data: metadata,
    } as FileMetadataResponse);
  } catch (error) {
    if ((error as Error).message.includes("File not found")) {
      res.status(404).json({
        error: {
          message: "File not found",
          status: 404,
        },
      } as ApiError);
      return;
    }
    next(error);
  }
};

// List files controller
export const listFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = listFilesSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }
    const { prefix, limit } = req.query as ListFilesQuery;
    const files = await fileService.listFiles(prefix, limit);

    res.status(200).json({
      success: true,
      data: {
        files,
        count: files.length,
      },
    } as ListFilesResponseWrapper);
  } catch (error) {
    next(error);
  }
};

// Get signed URL controller (for secure file access)
export const getSignedUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }

    const expirationMinutes = parseInt(req.query.expires as string) || 60;
    if (expirationMinutes < 1 || expirationMinutes > 1440) {
      // Max 24 hours
      res.status(400).json({
        error: {
          message: "Expiration must be between 1 and 1440 minutes (24 hours)",
          status: 400,
        },
      } as ApiError);
      return;
    }

    const signedUrl = await fileService.getSignedUrl(
      req.params.fileId,
      expirationMinutes
    );
    res.status(200).json({
      success: true,
      data: {
        signedUrl,
        fileId: req.params.fileId,
        expiresInMinutes: expirationMinutes,
        expiresAt: new Date(
          Date.now() + expirationMinutes * 60 * 1000
        ).toISOString(),
      },
    } as SignedUrlResponse);
  } catch (error) {
    if ((error as Error).message.includes("File not found")) {
      res.status(404).json({
        error: {
          message: "File not found",
          status: 404,
        },
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Get upload signed URL controller (for direct client uploads)
export const getUploadSignedUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uploadSignedUrlSchema = Joi.object({
      fileName: Joi.string().required(),
      contentType: Joi.string().required(),
      expirationMinutes: Joi.number().integer().min(1).max(60).optional(),
    });

    const { error } = uploadSignedUrlSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }

    const { fileName, contentType, expirationMinutes = 15 } = req.body;
    const signedUrl = await fileService.getUploadSignedUrl(
      fileName,
      contentType,
      expirationMinutes
    );
    res.status(200).json({
      success: true,
      data: {
        uploadUrl: signedUrl,
        fileName,
        contentType,
        expiresInMinutes: expirationMinutes,
        expiresAt: new Date(
          Date.now() + expirationMinutes * 60 * 1000
        ).toISOString(),
      },
    } as UploadSignedUrlResponse);
  } catch (error) {
    next(error);
  }
};

// Serve file directly (with caching)
export const serveFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = fileIdSchema.validate(req.params.fileId);
    if (error) {
      res.status(400).json({
        error: {
          message: error.details[0].message,
          status: 400,
        },
      } as ApiError);
      return;
    }

    const fileId = req.params.fileId;

    // Get file metadata first to determine content type
    const metadata = await fileService.getFileMetadata(fileId);

    // Get file buffer (from cache or download)
    const fileBuffer = await cacheService.getFileBuffer(fileId);    // Set appropriate headers
    res.set({
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      ETag: `"${fileId}"`,
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });

    // Check if client has cached version
    if (req.headers["if-none-match"] === `"${fileId}"`) {
      res.status(304).end();
      return;
    }

    res.send(fileBuffer);
  } catch (error) {
    if ((error as Error).message.includes("File not found")) {
      res.status(404).json({
        error: {
          message: "File not found",
          status: 404,
        },
      } as ApiError);
      return;
    }
    next(error);
  }
};

// Get cache statistics
export const getCacheStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await cacheService.getCacheStats();

    res.json({
      success: true,
      data: {
        ...stats,
        totalSizeFormatted: formatBytes(stats.totalSize),
        cacheDir: process.env.FILE_CACHE_DIR || "cache",
        maxAge: process.env.CACHE_MAX_AGE || "86400000",
        maxSize: process.env.CACHE_MAX_SIZE || "1073741824",
        maxSizeFormatted: formatBytes(
          parseInt(process.env.CACHE_MAX_SIZE || "1073741824")
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
