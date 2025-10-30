import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  PhotoLibrary as PhotoLibraryIcon
} from '@mui/icons-material';
import { photoService } from '../services/photoService';

interface FileUploadProps {
  albumId: string;
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface FileWithId {
  file: File;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ albumId, open, onClose, onUploadComplete }) => {
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file) => ({
        file,
        id: `${Date.now()}-${Math.random()}`
      }));

      // Filter for image and video files only
      const mediaFiles = newFiles.filter((item) => 
        item.file.type.startsWith('image/') || item.file.type.startsWith('video/')
      );

      if (mediaFiles.length !== newFiles.length) {
        setError('Only image and video files are allowed');
      } else {
        setError(null);
      }

      setFiles((prev) => [...prev, ...mediaFiles]);
    }
  };
  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      let completed = 0;

      for (const fileItem of files) {
        const file = fileItem.file;
        try {
          // Get signed URL for upload from album service (MinIO)
          const signedUrlResponse = await photoService.getUploadSignedUrl(file.name, file.type, albumId);

          // Upload file directly to MinIO
          await photoService.uploadFileToSignedUrl(signedUrlResponse.uploadUrl, file);

          // Create photo record in album service with minioFileId
          await photoService.createPhoto({
            filename: file.name,
            originalName: file.name,
            minioFileId: signedUrlResponse.minioFileId,
            albumId: albumId,
            mimetype: file.type,
            size: file.size
            // TODO: Extract image dimensions
            // width: undefined,
            // height: undefined,
          });

          completed++;
          setUploadProgress((completed / files.length) * 100);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // Success - close dialog and refresh photos
      handleClose();
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setError(null);
      setUploadProgress(0);
      onClose();
    }
  };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files).map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`
    }));

    const mediaFiles = droppedFiles.filter((item) => 
      item.file.type.startsWith('image/') || item.file.type.startsWith('video/')
    );

    if (mediaFiles.length !== droppedFiles.length) {
      setError('Only image and video files are allowed');
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...mediaFiles]);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Upload Photos and Videos</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: 'grey.50',
            cursor: 'pointer',
            mb: 2,
            '&:hover': { bgcolor: 'grey.100' }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <PhotoLibraryIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drop images and videos here or click to select
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supports: JPG, PNG, GIF, WebP, MP4, MOV, AVI, and more
          </Typography>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </Box>

        {uploading && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Uploading... {Math.round(uploadProgress)}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        {files.length > 0 && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Selected Files ({files.length})
            </Typography>

            <List dense>
              {files.map((fileItem) => (
                <ListItem key={fileItem.id} divider sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.875rem',
                          wordBreak: 'break-all',
                          lineHeight: 1.2
                        }}
                      >
                        {fileItem.file.name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(fileItem.file.size)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" onClick={() => removeFile(fileItem.id)} disabled={uploading}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={uploadFiles}
          variant="contained"
          disabled={files.length === 0 || uploading}
          startIcon={<CloudUploadIcon />}
        >
          Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUpload;
