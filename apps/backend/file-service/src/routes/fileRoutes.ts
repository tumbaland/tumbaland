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
