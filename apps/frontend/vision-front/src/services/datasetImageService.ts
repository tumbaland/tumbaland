import { getGlobalConfig } from '../config/ConfigProvider';

export interface DatasetImage {
  _id: string;
  filename: string;
  originalName: string;
  minioFileId: string;
  minioThumbnailFileId?: string;
  datasetId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags: string[];
  metadata: any;
  signedUrl?: string;
  signedUrlExpiresAt?: string;
  signedUrlExpiresInMinutes?: number;
  thumbnailSignedUrl?: string;
  thumbnailSignedUrlExpiresAt?: string;
  thumbnailSignedUrlExpiresInMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetImagesResponse {
  success: boolean;
  data: {
    images: DatasetImage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

/**
 * Get images by dataset ID
 */
export const getImagesByDataset = async (
  datasetId: string,
  page: number = 1,
  limit?: number,
  search?: string
): Promise<DatasetImagesResponse> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const params = new URLSearchParams({ page: String(page) });
  if (limit) params.append('limit', String(limit));
  if (search) params.append('search', search);

  const response = await fetch(`${apiUrl}/api/dataset-images/dataset/${datasetId}?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch dataset images');
  }

  return response.json();
};

/**
 * Get image by ID
 */
export const getImageById = async (id: string): Promise<DatasetImage> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const response = await fetch(`${apiUrl}/api/dataset-images/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch dataset image');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Create dataset image
 */
export const createDatasetImage = async (imageData: {
  filename: string;
  originalName: string;
  minioFileId: string;
  datasetId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags?: string[];
  metadata?: any;
}): Promise<DatasetImage> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const response = await fetch(`${apiUrl}/api/dataset-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(imageData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create dataset image');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Update dataset image
 */
export const updateDatasetImage = async (
  id: string,
  updateData: {
    title?: string;
    description?: string;
    tags?: string[];
    metadata?: any;
  }
): Promise<DatasetImage> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const response = await fetch(`${apiUrl}/api/dataset-images/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update dataset image');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Delete dataset image
 */
export const deleteDatasetImage = async (id: string): Promise<void> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const response = await fetch(`${apiUrl}/api/dataset-images/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete dataset image');
  }
};

/**
 * Get upload signed URL for direct client upload
 */
export const getUploadSignedUrl = async (data: {
  filename: string;
  mimetype: string;
  datasetId: string;
}): Promise<{
  uploadUrl: string;
  minioFileId: string;
  datasetId: string;
  expiresInMinutes: number;
}> => {
  const config = getGlobalConfig();
  const apiUrl = config.VISION_API_URL || 'https://vision-api.tumbaland.eu';

  const response = await fetch(`${apiUrl}/api/dataset-images/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get upload signed URL');
  }

  const result = await response.json();
  return result.data;
};

/**
 * Upload file to signed URL
 */
export const uploadFileToSignedUrl = async (signedUrl: string, file: File): Promise<void> => {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });

  if (!response.ok) {
    throw new Error('Failed to upload file to signed URL');
  }
};