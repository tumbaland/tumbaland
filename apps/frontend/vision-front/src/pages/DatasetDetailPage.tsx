import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalysisById, updateAnalysis, deleteAnalysis } from '../services/analysisService';
import { getImagesByDataset, DatasetImage, deleteDatasetImage } from '../services/datasetImageService';
import FileUpload from '../components/FileUpload';

const DatasetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState<string | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<DatasetImage | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => getAnalysisById(id!),
    enabled: Boolean(id)
  });

  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['datasetImages', id],
    queryFn: () => getImagesByDataset(id!, 1, 50),
    enabled: Boolean(id)
  });

  const images = imagesData?.data?.images || [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUploadComplete = () => {
    // Invalidate and refetch images
    queryClient.invalidateQueries({ queryKey: ['datasetImages', id] });
  };

  const handleJsonFileClick = () => {
    fileInputRef.current?.click();
  };

    const handleJsonFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingJson(true);
      setJsonError(null);
      setJsonSuccess(null);

      // Read file content
      const content = await file.text();
      const jsonData = JSON.parse(content);

      // Update the analysis with the JSON data
      await updateAnalysis(id!, {
        dataset: analysis!.dataset,
        data: jsonData
      });

      setJsonSuccess('JSON data uploaded successfully!');
      
      // Refresh the analysis data
      queryClient.invalidateQueries({ queryKey: ['analysis', id] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Failed to upload JSON data');
    } finally {
      setUploadingJson(false);
    }
  };

  const handleImageClick = (image: DatasetImage) => {
    setSelectedImage(image);
    setImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    try {
      setDeleting(true);
      await deleteAnalysis(id);
      navigate('/analysis');
    } catch (err) {
      console.error('Failed to delete analysis:', err);
      // You might want to show an error message here
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      setDeletingImageId(imageId);
      await deleteDatasetImage(imageId);
      // Refresh the images list
      queryClient.invalidateQueries({ queryKey: ['datasetImages', id] });
    } catch (err) {
      console.error('Failed to delete image:', err);
      // You might want to show an error message here
    } finally {
      setDeletingImageId(null);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dataset analysis...
        </Typography>
      </Container>
    );
  }

  if (error || !analysis) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load dataset analysis: {error instanceof Error ? error.message : 'Analysis not found'}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/analysis')}>
            Back to Analyses
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Dataset Analysis: {analysis.dataset}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Created: {new Date(analysis.createdAt).toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteClick}
          >
            Delete
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/analysis')}
          >
            Back to Analyses
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Dataset Description" />
          <Tab label="Example Images" />
        </Tabs>

        {/* Tab Panels */}
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    Dataset Analysis Data
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Upload JSON analysis data for this dataset.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={jsonExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setJsonExpanded(!jsonExpanded)}
                  >
                    {jsonExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={uploadingJson ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                    onClick={handleJsonFileClick}
                    disabled={uploadingJson}
                  >
                    {uploadingJson ? 'Uploading...' : 'Upload JSON'}
                  </Button>
                </Box>
              </Box>

              {/* JSON File Input (hidden) */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonFileChange}
                style={{ display: 'none' }}
              />

              {/* JSON Messages */}
              {jsonError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {jsonError}
                </Alert>
              )}

              {jsonSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {jsonSuccess}
                </Alert>
              )}

              <Paper sx={{ 
                p: 2, 
                backgroundColor: '#f5f5f5', 
                maxHeight: jsonExpanded ? 'none' : '70vh', 
                overflow: jsonExpanded ? 'visible' : 'auto',
                transition: 'max-height 0.3s ease-in-out'
              }}>
                <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                  {JSON.stringify(analysis.data || (() => {
                    // Handle legacy data structure where JSON is at top level
                    const { _id, createdAt, updatedAt, ...jsonData } = analysis as any;
                    return jsonData;
                  })(), null, 2)}
                </pre>
              </Paper>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6">
                    Example Images ({images.length})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Sample images from the dataset analysis.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => setShowUploadDialog(true)}
                >
                  Upload Images
                </Button>
              </Box>

              {imagesLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Loading images...
                  </Typography>
                </Box>
              ) : images.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" color="text.secondary">
                    No images available
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Images will be displayed here once uploaded to the dataset.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(4, 1fr)'
                    },
                    gap: 2
                  }}
                >
                  {images.map((image: DatasetImage) => (
                    <Card key={image._id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ position: 'relative' }}>
                        <CardMedia
                          component="img"
                          height="200"
                          image={image.thumbnailSignedUrl || image.signedUrl}
                          alt={image.title || image.originalName}
                          sx={{ objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => handleImageClick(image)}
                        />
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(image._id);
                          }}
                          disabled={deletingImageId === image._id}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: 'rgba(244, 67, 54, 0.8)',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'rgba(211, 47, 47, 0.9)',
                            },
                            '&:disabled': {
                              bgcolor: 'rgba(244, 67, 54, 0.4)',
                            },
                          }}
                          size="small"
                        >
                          {deletingImageId === image._id ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {image.title || image.originalName}
                        </Typography>
                        {image.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {image.description}
                          </Typography>
                        )}
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {image.tags.slice(0, 2).map((tag, index) => (
                            <Chip key={index} label={tag} size="small" variant="outlined" />
                          ))}
                          {image.tags.length > 2 && (
                            <Chip label={`+${image.tags.length - 2}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Upload Dialog */}
      <FileUpload
        datasetId={id!}
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Image Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={handleCloseImageModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={handleCloseImageModal}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)',
              },
              zIndex: 1,
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage.signedUrl}
              alt={selectedImage.title || selectedImage.originalName}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Dataset Analysis
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the dataset analysis "{analysis?.dataset}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DatasetDetailPage;