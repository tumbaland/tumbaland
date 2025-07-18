import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  IconButton,
  Card,
  CardContent,
  Divider,
  Tab,
  Tabs
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
  Label as LabelIcon,
  PhotoLibrary as PhotoLibraryIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { Photo, Album } from '../types';
import { albumService } from '../services/albumService';
import { photoService } from '../services/photoService';
import EditPhotoDialog from '../components/EditPhotoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { aiService } from '../services/aiService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`photo-tabpanel-${index}`}
      aria-labelledby={`photo-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const PhotoDetailPage: React.FC = () => {
  const { albumId, photoId } = useParams<{ albumId: string; photoId: string }>();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // ML Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!albumId || !photoId) return;
      
      try {
        setLoading(true);
        // Fetch both photo and album data
        const [photoResponse, albumResponse] = await Promise.all([
          photoService.getPhotoById(photoId),
          albumService.getAlbumById(albumId)
        ]);
        
        setPhoto(photoResponse.data);
        setAlbum(albumResponse.data);
      } catch (err) {
        setError('Failed to load photo details');
        console.error('Error fetching photo details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [albumId, photoId]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!photo || !albumId) return;

    setDeleting(true);
    try {
      await photoService.deletePhoto(photo._id);
      navigate(`/albums/${albumId}`);
    } catch (err) {
      alert('Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (photoId: string, data: { title?: string; description?: string }) => {
    try {
      const response = await photoService.updatePhoto(photoId, data);
      setPhoto(response.data);
      setShowEditDialog(false);
    } catch (err) {
      console.error('Failed to update photo:', err);
      alert('Failed to update photo');
    }
  };

  const handleRunAnalysis = async (analysisType: string) => {
    if (!photo) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      let response;
      
      switch (analysisType) {
        case 'classification':
          response = await aiService.runImageClassification(photo._id);
          break;
        case 'detection':
          response = await aiService.runObjectDetection(photo._id);
          break;
        case 'segmentation':
          response = await aiService.runSemanticSegmentation(photo._id);
          break;
        case 'tagging':
          response = await aiService.generateAutoTags(photo._id);
          break;
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }
      
      setAnalysisResults({
        type: analysisType,
        timestamp: new Date().toISOString(),
        results: response.data
      });
    } catch (err) {
      setAnalysisError(`Failed to run ${analysisType} analysis`);
      console.error(`${analysisType} analysis error:`, err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !photo || !album) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Photo not found'}</Alert>
        <Button onClick={() => navigate(`/albums/${albumId}`)} sx={{ mt: 2 }}>
          Back to Album
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link 
          component="button" 
          variant="body1" 
          onClick={() => navigate('/albums')} 
          sx={{ textDecoration: 'none' }}
        >
          Albums
        </Link>
        <Link 
          component="button" 
          variant="body1" 
          onClick={() => navigate(`/albums/${albumId}`)} 
          sx={{ textDecoration: 'none' }}
        >
          {album.name}
        </Link>
        <Typography color="text.primary">
          {photo.title || photo.originalName}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate(`/albums/${albumId}`)} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {photo.title || photo.originalName}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => {/* TODO: Implement share */}}
          >
            Share
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => window.open(photo.signedUrl, '_blank')}
          >
            Download
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Photo Display */}
        <Box sx={{ flex: 2 }}>
          <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Box
              component="img"
              src={photo.signedUrl}
              alt={photo.title || photo.originalName}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 1
              }}
            />
          </Paper>
        </Box>

        {/* Photo Details Sidebar */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Photo Details
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1">
                {photo.description || 'No description'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                File Size
              </Typography>
              <Typography variant="body1">
                {formatFileSize(photo.size)}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Dimensions
              </Typography>
              <Typography variant="body1">
                {photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'Unknown'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Upload Date
              </Typography>
              <Typography variant="body1">
                {formatDate(photo.createdAt)}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Original Name
              </Typography>
              <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                {photo.originalName}
              </Typography>
            </Box>

            {photo.tags && photo.tags.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {photo.tags.map((tag, index) => (
                    <Chip key={index} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* ML Analysis Section */}
      <Box sx={{ mt: 4 }}>
        <Paper elevation={2}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab 
                label="Basic Info" 
                icon={<PhotoLibraryIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="AI Analysis" 
                icon={<AnalyticsIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="Auto Tagging" 
                icon={<LabelIcon />} 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This section shows the basic metadata and EXIF data of the photo.
            </Typography>
            {/* TODO: Add EXIF data display */}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              AI-Powered Image Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Run machine learning analysis on this image for classification, object detection, and semantic segmentation.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                onClick={() => handleRunAnalysis('classification')}
                disabled={isAnalyzing}
              >
                Image Classification
              </Button>
              <Button
                variant="contained"
                onClick={() => handleRunAnalysis('detection')}
                disabled={isAnalyzing}
              >
                Object Detection
              </Button>
              <Button
                variant="contained"
                onClick={() => handleRunAnalysis('segmentation')}
                disabled={isAnalyzing}
              >
                Semantic Segmentation
              </Button>
            </Box>

            {isAnalyzing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CircularProgress size={24} />
                <Typography>Running analysis...</Typography>
              </Box>
            )}

            {analysisError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {analysisError}
              </Alert>
            )}

            {analysisResults && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Analysis Results ({analysisResults.type})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Completed at: {formatDate(analysisResults.timestamp)}
                  </Typography>
                  <Typography variant="body1">
                    {analysisResults.results}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Automatic Tagging
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Generate automatic tags based on image content using computer vision.
            </Typography>
            
            <Button
              variant="contained"
              onClick={() => handleRunAnalysis('tagging')}
              disabled={isAnalyzing}
            >
              Generate Auto Tags
            </Button>
            
            {/* TODO: Display generated tags */}
          </TabPanel>
        </Paper>
      </Box>

      {/* Edit Dialog */}
      <EditPhotoDialog
        open={showEditDialog}
        photo={photo}
        onClose={() => setShowEditDialog(false)}
        onSave={handleSaveEdit}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmText="Delete Photo"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </Container>
  );
};

export default PhotoDetailPage;
