import { bucket } from "../config/storage";
import { generateFileName } from "../config/multer";
import * as cacheService from "../config/cache";
import {
  FileUploadData,
  FileDownloadData,
  FileDeleteResult,
  FileMetadata,
} from "../types";

// Upload file to Google Cloud Storage
export const uploadFile = async (
  file: Express.Multer.File
): Promise<FileUploadData> => {
  try {
    const fileName = generateFileName(file.originalname);
    const fileUpload = bucket.file(fileName);

    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
    });

    return new Promise((resolve, reject) => {
      stream.on("error", (error) => {
        reject(error);
      });
      stream.on("finish", async () => {
        try {
          // Get file metadata to confirm upload
          const [metadata] = await fileUpload.getMetadata();

          // Generate a signed URL for secure access (valid for 1 hour)
          const signedUrl = await getSignedUrl(fileName, 60);

          const fileData: FileUploadData = {
            id: fileName,
            name: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            url: signedUrl, // Use signed URL for secure access
            uploadedAt: new Date().toISOString(),
          };

          resolve(fileData);
        } catch (error) {
          reject(error);
        }
      });

      stream.end(file.buffer);
    });
  } catch (error) {
    throw new Error(`Failed to upload file: ${(error as Error).message}`);
  }
};

// Download file from Google Cloud Storage
export const downloadFile = async (
  fileId: string
): Promise<FileDownloadData> => {
  try {
    const file = bucket.file(fileId);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("File not found");
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();

    // Create download stream
    const stream = file.createReadStream();
    return {
      stream,
      metadata: {
        contentType: metadata.contentType,
        size: metadata.size || 0,
        name: metadata.name || fileId,
      },
    };
  } catch (error) {
    throw new Error(`Failed to download file: ${(error as Error).message}`);
  }
};

// Delete file from Google Cloud Storage
export const deleteFile = async (fileId: string): Promise<FileDeleteResult> => {
  try {
    const file = bucket.file(fileId);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("File not found");
    }

    await file.delete();

    // Remove from cache as well
    await cacheService.removeFromCache(fileId);

    return {
      message: "File deleted successfully",
      fileId,
      deletedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to delete file: ${(error as Error).message}`);
  }
};

// Get file metadata
export const getFileMetadata = async (
  fileId: string
): Promise<FileMetadata> => {
  try {
    const file = bucket.file(fileId);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("File not found");
    }

    const [metadata] = await file.getMetadata();

    // Generate a signed URL for secure access (valid for 1 hour)
    const signedUrl = await getSignedUrl(fileId, 60);

    return {
      id: fileId,
      name: metadata.name || fileId,
      size: metadata.size || 0,
      contentType: metadata.contentType,
      created: metadata.timeCreated,
      updated: metadata.updated,
      url: signedUrl, // Use signed URL for secure access
    };
  } catch (error) {
    throw new Error(`Failed to get file metadata: ${(error as Error).message}`);
  }
};

// List all files in bucket
export const listFiles = async (
  prefix: string = "",
  limit: number = 100
): Promise<FileMetadata[]> => {
  try {
    const options = {
      prefix,
      maxResults: limit,
    };

    const [files] = await bucket.getFiles(options);

    // Generate signed URLs for all files
    const fileList: FileMetadata[] = await Promise.all(
      files.map(async (file) => {
        const signedUrl = await getSignedUrl(file.name, 60);
        return {
          id: file.name,
          name: file.name,
          size: file.metadata.size || 0,
          contentType: file.metadata.contentType,
          created: file.metadata.timeCreated,
          updated: file.metadata.updated,
          url: signedUrl, // Use signed URL for secure access
        };
      })
    );

    return fileList;
  } catch (error) {
    throw new Error(`Failed to list files: ${(error as Error).message}`);
  }
};

// Generate signed URL for secure file access (for uniform bucket-level access)
export const getSignedUrl = async (
  fileId: string,
  expirationMinutes: number = 60
): Promise<string> => {
  try {
    const file = bucket.file(fileId);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("File not found");
    }

    const options = {
      version: "v4" as const,
      action: "read" as const,
      expires: Date.now() + expirationMinutes * 60 * 1000, // expires in specified minutes
    };

    const [signedUrl] = await file.getSignedUrl(options);
    return signedUrl;
  } catch (error) {
    throw new Error(
      `Failed to generate signed URL: ${(error as Error).message}`
    );
  }
};

// Generate upload signed URL for direct upload from client
export const getUploadSignedUrl = async (
  fileName: string,
  contentType: string,
  expirationMinutes: number = 15
): Promise<string> => {
  try {
    const file = bucket.file(fileName);

    const options = {
      version: "v4" as const,
      action: "write" as const,
      expires: Date.now() + expirationMinutes * 60 * 1000, // expires in specified minutes
      contentType,
    };

    const [signedUrl] = await file.getSignedUrl(options);
    return signedUrl;
  } catch (error) {
    throw new Error(
      `Failed to generate upload signed URL: ${(error as Error).message}`
    );
  }
};
