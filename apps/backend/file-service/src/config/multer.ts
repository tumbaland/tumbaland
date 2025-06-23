import multer from "multer";
import { v4 as uuidv4 } from "uuid";

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Define allowed file types
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only images, PDFs, and documents are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Generate unique filename
const generateFileName = (originalName: string): string => {
  const extension = originalName.split(".").pop();
  return `${uuidv4()}.${extension}`;
};

export { upload, generateFileName };
