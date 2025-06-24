import express from "express";
import {
  createPhoto,
  getPhotosByAlbum,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getUploadSignedUrlRequest,
} from "../controllers/photoController";

const router = express.Router();

// Photo routes
router.post("/", createPhoto);
router.get("/album/:albumId", getPhotosByAlbum);
router.get("/:id", getPhotoById);
router.put("/:id", updatePhoto);
router.delete("/:id", deletePhoto);

// Upload routes
router.post("/upload-url", getUploadSignedUrlRequest);

export default router;
