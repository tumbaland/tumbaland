import { Request, Response } from 'express';
import {
  writeFile,
  readFile,
  deleteFile,
  deleteByPrefix,
  fileExists,
  getMetadata,
  listFiles
} from '../utils/storage';
import { logger, NotFoundError, sendSuccess } from '@tumbaland/core';

/**
 * PUT /internal/files/:fileId
 * Server-to-server raw buffer upload.
 * Accepts raw binary body.
 */
export const internalUpload = (req: Request, res: Response): void => {
  const fileId = [req.params.fileId].flat().join('/');
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      writeFile(fileId, buffer);
      res.status(200).json({ success: true, fileId, size: buffer.length });
    } catch (err) {
      logger.error(`Internal upload failed for ${fileId}:`, err);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  });
  req.on('error', (err) => {
    logger.error(`Internal upload stream error for ${fileId}:`, err);
    res.status(500).json({ success: false, message: 'Upload stream error' });
  });
};

/**
 * GET /internal/files/:fileId
 * Server-to-server download – returns raw binary.
 */
export const internalDownload = (req: Request, res: Response): void => {
  const fileId = [req.params.fileId].flat().join('/');

  if (!fileExists(fileId)) {
    throw new NotFoundError('File not found');
  }

  const buffer = readFile(fileId);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(buffer);
};

/**
 * HEAD /internal/files/:fileId
 * Check file existence.
 */
export const internalExists = (req: Request, res: Response): void => {
  const fileId = [req.params.fileId].flat().join('/');
  if (fileExists(fileId)) {
    res.status(200).end();
  } else {
    res.status(404).end();
  }
};

/**
 * GET /internal/meta/:fileId
 * Returns size and lastModified.
 */
export const internalMetadata = (req: Request, res: Response): void => {
  const fileId = [req.params.fileId].flat().join('/');

  if (!fileExists(fileId)) {
    throw new NotFoundError('File not found');
  }

  const meta = getMetadata(fileId);
  sendSuccess(res, meta);
};

/**
 * DELETE /internal/files/:fileId
 * Delete a single file.
 */
export const internalDelete = (req: Request, res: Response): void => {
  const fileId = [req.params.fileId].flat().join('/');
  deleteFile(fileId);
  sendSuccess(res, undefined, 'File deleted');
};

/**
 * DELETE /internal/files/folder
 * Body: { prefix: string }
 * Delete all files matching a path prefix (folder delete).
 */
export const internalDeleteFolder = (req: Request, res: Response): void => {
  const { prefix } = req.body as { prefix: string };

  const count = deleteByPrefix(prefix);
  res.json({ success: true, message: `Deleted ${count} file(s)`, count });
};

/**
 * GET /internal/files?prefix=...&maxKeys=...
 * List files.
 */
export const internalList = (req: Request, res: Response): void => {
  const { prefix, maxKeys } = req.query as { prefix?: string; maxKeys?: string };
  const files = listFiles(prefix, maxKeys ? parseInt(maxKeys, 10) : 1000);
  sendSuccess(res, files);
};
