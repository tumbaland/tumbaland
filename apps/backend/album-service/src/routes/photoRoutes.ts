import express from "express";
import {
  createPhoto,
  getPhotosByAlbum,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getUploadSignedUrlRequest,
} from "../controllers/photoController";
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Photo routes
router.post("/", authenticateToken, createPhoto);
router.get("/album/:albumId", authenticateToken, getPhotosByAlbum);
router.get("/:id", authenticateToken, getPhotoById);
router.put("/:id", authenticateToken, updatePhoto);
router.delete("/:id", authenticateToken, deletePhoto);

// Upload routes
router.post("/upload-url", authenticateToken, getUploadSignedUrlRequest);

export default router;
