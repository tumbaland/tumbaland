export interface FileUploadData {
  id: string;
  name: string;
  size: number;
  mimetype: string;
  url: string;
  uploadedAt: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number | string;
  contentType?: string;
  created?: string;
  updated?: string;
  url: string;
}

export interface FileDownloadData {
  stream: NodeJS.ReadableStream;
  metadata: {
    contentType?: string;
    size: number | string;
    name: string;
  };
}

export interface FileDeleteResult {
  message: string;
  fileId: string;
  deletedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ApiError {
  error: {
    message: string;
    status: number;
  };
}

export interface ListFilesQuery {
  prefix?: string;
  limit?: number;
}

export interface ListFilesResponse {
  files: FileMetadata[];
  count: number;
}

export interface UploadResponse {
  success: true;
  message: string;
  data: FileUploadData;
}

export interface SignedUrlResponse {
  success: true;
  data: {
    signedUrl: string;
    fileId: string;
    expiresInMinutes: number;
    expiresAt: string;
  };
}

export interface BatchSignedUrlEntry {
  fileId: string;
  signedUrl: string;
  expiresInMinutes: number;
  expiresAt: string;
}

export interface BatchSignedUrlsResponse {
  success: true;
  data: BatchSignedUrlEntry[];
  errors?: Array<{
    fileId: string;
    message: string;
  }>;
}

export interface BatchSignedUrlsRequest {
  fileIds: string[];
  expiresInMinutes?: number;
}

export interface UploadSignedUrlResponse {
  success: true;
  data: {
    uploadUrl: string;
    fileName: string;
    contentType: string;
    expiresInMinutes: number;
    expiresAt: string;
  };
}

export interface FileMetadataResponse {
  success: true;
  data: FileMetadata;
}

export interface ListFilesResponseWrapper {
  success: true;
  data: ListFilesResponse;
}

export interface DeleteFileResponse {
  success: true;
  data: FileDeleteResult;
}
