export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimetype: string;
  url?: string;
  uploadedAt: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: FileMetadata;
}

export const getFileMetadata = async (fileId: string): Promise<FileMetadata> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/${fileId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    throw new Error('Failed to fetch file metadata');
  }
};

export interface SignedUrlData {
  signedUrl: string;
  expiresAt: string;
  expiresInMinutes: number;
}

export const getSignedUrl = async (fileId: string): Promise<SignedUrlData | null> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/signed-url/${fileId}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      signedUrl: data.data.signedUrl,
      expiresAt: data.data.expiresAt,
      expiresInMinutes: data.data.expiresInMinutes
    };
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw new Error('Failed to get signed URL');
  }
};

export const getSignedUrlsBatch = async (
  fileIds: string[],
  expiresInMinutes: number = 60
): Promise<Record<string, SignedUrlData>> => {
  const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
  if (uniqueFileIds.length === 0) {
    return {};
  }

  const fallbackFetch = async (): Promise<Record<string, SignedUrlData>> => {
    const result: Record<string, SignedUrlData> = {};
    await Promise.all(
      uniqueFileIds.map(async (fileId) => {
        try {
          const data = await getSignedUrl(fileId);
          if (data) {
            result[fileId] = data;
          }
        } catch (error) {
          console.warn(`Fallback signed URL fetch failed for file ${fileId}:`, error);
        }
      })
    );
    return result;
  };

  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/signed-url/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileIds: uniqueFileIds,
        expiresInMinutes
      })
    });

    if (response.status === 404) {
      console.warn('Batch signed URL endpoint not found. Falling back to individual requests.');
      return fallbackFetch();
    }

    if (!response.ok) {
      console.warn(
        `Batch signed URL request failed with status ${response.status}. Falling back to individual requests.`
      );
      return fallbackFetch();
    }

    const data = await response.json();
    const result: Record<string, SignedUrlData> = {};

    (data.data || []).forEach((entry: any) => {
      if (entry?.fileId && entry?.signedUrl) {
        result[entry.fileId] = {
          signedUrl: entry.signedUrl,
          expiresAt: entry.expiresAt,
          expiresInMinutes: entry.expiresInMinutes
        };
      }
    });

    return result;
  } catch (error) {
    console.warn('Error getting batch signed URLs, falling back to individual requests:', error);
    return fallbackFetch();
  }
};

export const getFileUrl = async (fileId: string): Promise<string> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    return `${FILE_API_URL}/api/serve/${fileId}`;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw new Error('Failed to get file URL');
  }
};

export const deleteFile = async (fileId: string): Promise<boolean> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/${fileId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

export const getFileUploadSignedUrl = async (
  filename: string,
  mimetype: string
): Promise<{ url: string; fileId: string }> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: filename,
        contentType: mimetype,
        expirationMinutes: 15
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.data.uploadUrl,
      fileId: data.data.fileName
    };
  } catch (error) {
    console.error('Error getting upload signed URL:', error);
    throw new Error('Failed to get upload signed URL');
  }
};
