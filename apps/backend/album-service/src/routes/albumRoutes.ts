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

const router = express.Router();

// Album routes
router.post("/", createAlbum);
router.get("/", getAlbums);
router.get("/:id", getAlbumById);
router.put("/:id", updateAlbum);
router.delete("/:id", deleteAlbum);

// Cover photo routes
router.put("/:id/cover", setCoverPhoto);
router.delete("/:id/cover", removeCoverPhoto);

export default router;
