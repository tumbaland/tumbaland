import express from "express";
import {
  createAlbum,
  deleteAlbum,
  getAlbumById,
  getAlbums,
  updateAlbum,
  setCoverPhoto,
  removeCoverPhoto,
} from "../controllers/albumController";
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Album routes
router.post("/", authenticateToken, createAlbum);
router.get("/", authenticateToken, getAlbums);
router.get("/:id", authenticateToken, getAlbumById);
router.put("/:id", authenticateToken, updateAlbum);
router.delete("/:id", authenticateToken, deleteAlbum);

// Cover photo routes
router.put("/:id/cover", authenticateToken, setCoverPhoto);
router.delete("/:id/cover", authenticateToken, removeCoverPhoto);

export default router;
