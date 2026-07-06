import React, { useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
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

  const getImageDimensions = (file: File): Promise<{ width: number; height: number } | undefined> => {
    if (!file.type.startsWith('image/')) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
      };
      img.src = objectUrl;
    });
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

          const dimensions = await getImageDimensions(file);

          // Create photo record in album service with minioFileId
          await photoService.createPhoto({
            filename: file.name,
            originalName: file.name,
            minioFileId: signedUrlResponse.minioFileId,
            albumId: albumId,
            mimetype: file.type,
            size: file.size,
            width: dimensions?.width,
            height: dimensions?.height
          });

          completed++;
          setUploadProgress((completed / files.length) * 100);
        } catch (err) {
          logger.error(`Failed to upload ${file.name}`, err);
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
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>Upload Photos and Videos</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 3,
            p: 6,
            textAlign: 'center',
            bgcolor: 'rgba(99, 102, 241, 0.04)',
            cursor: 'pointer',
            mb: 3,
            transition: 'all 0.2s ease',
            '&:hover': { 
              bgcolor: 'rgba(99, 102, 241, 0.08)',
              borderColor: 'primary.dark',
              transform: 'scale(1.01)'
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <PhotoLibraryIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.8 }} />
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: "primary.dark"
            }}>
            Drop images and videos here
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              mb: 1
            }}>
            or click to browse from your computer
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: 'block',
              mt: 2,
              opacity: 0.7
            }}>
            Supports: JPG, PNG, GIF, WebP, MP4, MOV, AVI
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
          <Box sx={{ mt: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{
                fontWeight: 500
              }}>Uploading...</Typography>
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{Math.round(uploadProgress)}%</Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'
                }
              }} 
            />
          </Box>
        )}

        {files.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Selected Files ({files.length})
            </Typography>

            <List dense sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 2 }}>
              {files.map((fileItem) => (
                <ListItem key={fileItem.id} divider sx={{ py: 1 }}>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          wordBreak: 'break-all'
                        }}
                      >
                        {fileItem.file.name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" sx={{
                        color: "text.secondary"
                      }}>
                        {formatFileSize(fileItem.file.size)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      size="small" 
                      onClick={() => removeFile(fileItem.id)} 
                      disabled={uploading}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={uploading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          onClick={uploadFiles}
          variant="contained"
          disabled={files.length === 0 || uploading}
          startIcon={<CloudUploadIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.12)'
            }
          }}
        >
          Upload {files.length > 0 ? `${files.length} ${files.length === 1 ? 'File' : 'Files'}` : 'Files'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileUpload;
