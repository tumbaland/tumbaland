import { Request, Response, NextFunction } from 'express';
import { resolvePath, TooLargeError, writeStream } from '../utils/storage';
import { logger } from '@tumbaland/backend-core';

/**
 * The largest body a browser may upload, 95 MB by default.
 *
 * Just under Cloudflare's 100 MB request limit, which is what really stops a
 * bigger upload in production; chat-service and album-service refuse larger
 * files before handing out an upload URL. Checked here too because a signed
 * URL carries no size, so without it a URL minted for a small photo would
 * accept anything.
 */
export const maxUploadBytes = (): number =>
  Number(process.env.FILE_SERVICE_MAX_UPLOAD_BYTES) || 95 * 1024 * 1024;

/**
 * PUT /files/upload/:fileId?token=...&expires=...
 * Browser-direct upload. Token validated by requireSignedToken middleware.
 * Accepts raw binary body (Content-Type set by browser / client).
 */
export const uploadPublic = async (req: Request, res: Response): Promise<void> => {
  const fileId = [req.params.fileId].flat().join('/');
  const signed = res.locals.maxBytes as number | undefined;
  const limit = Math.min(maxUploadBytes(), signed ?? Infinity);
  // The rest of the body is never read, so the connection cannot be reused.
  const tooLarge = () =>
    res.status(413).set('Connection', 'close').json({
      success: false,
      message:
        signed !== undefined && signed < maxUploadBytes()
          ? 'The file is bigger than the size given when the upload was started.'
          : `That file is too large. The limit is ${Math.floor(limit / (1024 * 1024))} MB.`
    });

  // Refused before a byte is read when the browser says up front.
  if (Number(req.headers['content-length']) > limit) {
    tooLarge();
    return;
  }

  try {
    await writeStream(fileId, req, limit);
    res.status(200).json({ success: true, message: 'File uploaded', fileId });
  } catch (err) {
    if (err instanceof TooLargeError) {
      tooLarge();
      return;
    }
    logger.error(`Public upload failed for ${fileId}:`, err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  // Chat's voice messages. `.weba` rather than `.webm`, so a recording is not
  // labelled as a video; iOS Safari will not play audio sent as a download.
  weba: 'audio/webm',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  pdf: 'application/pdf'
};

/**
 * GET /files/download/:fileId?token=...&expires=...
 * Browser-direct download/display. Token validated by requireSignedToken middleware.
 *
 * Streamed from disk with Range support rather than read into memory. iOS
 * Safari will not play a video from a server that cannot answer a byte range,
 * and reading a whole video synchronously stalled every other request.
 */
export const downloadPublic = (req: Request, res: Response, next: NextFunction): void => {
  const fileId = [req.params.fileId].flat().join('/');

  // Only a known extension gets a real type; anything else is a download, so
  // an uploaded page or script can never be served as something runnable.
  const ext = fileId.split('.').pop()?.toLowerCase() ?? '';
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  res.sendFile(resolvePath(fileId), { dotfiles: 'allow', cacheControl: false, lastModified: true }, (err) => {
    if (!err) return;
    if (res.headersSent) {
      // The client went away mid-video; nothing to answer.
      return;
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR' || (err as { status?: number }).status === 404) {
      res.removeHeader('Cache-Control');
      res.removeHeader('Content-Type');
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    res.removeHeader('Content-Type');
    next(err);
  });
};
