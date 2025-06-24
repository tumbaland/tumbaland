import express from "express";
import { upload } from "../config/multer";
import * as fileController from "../controllers/fileController";

const router = express.Router();

// Upload file
router.post(
  "/upload",
  upload.single("file") as any,
  fileController.uploadFile as any
);

// Get upload signed URL (for direct client uploads)
router.post("/upload-url", fileController.getUploadSignedUrl as any);

// Serve file directly (with caching) - NEW ENDPOINT
router.get("/serve/:fileId", fileController.serveFile as any);

// OPTIONS handler for serve endpoint (CORS preflight)
router.options("/serve/:fileId", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cross-Origin-Resource-Policy": "cross-origin"
  });
  res.status(200).end();
});

// Get cache statistics - NEW ENDPOINT
router.get("/cache/stats", fileController.getCacheStats as any);

// Get signed URL for file access
router.get("/signed-url/:fileId", fileController.getSignedUrl as any);

// Download file
router.get("/download/:fileId", fileController.downloadFile as any);

// Delete file
router.delete("/:fileId", fileController.deleteFile as any);

// Get file metadata
router.get("/:fileId", fileController.getFileMetadata as any);

// List files
router.get("/", fileController.listFiles as any);

export default router;
