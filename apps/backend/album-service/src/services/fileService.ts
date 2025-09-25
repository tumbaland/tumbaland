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

export const getSignedUrl = async (fileId: string): Promise<string> => {
  try {
    const FILE_API_URL = process.env.FILE_API_URL;
    const response = await fetch(`${FILE_API_URL}/api/signed-url/${fileId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw new Error('Failed to get signed URL');
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
