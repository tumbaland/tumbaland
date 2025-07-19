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
  SmartToy as SmartToyIcon,
  ViewInAr as ViewInArIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { Photo, Album } from '../types';
import { albumService } from '../services/albumService';
import { photoService } from '../services/photoService';
import EditPhotoDialog from '../components/EditPhotoDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { aiService, AIServiceError, HealthStatus, ObjectDetectionResult, SegmentationResult } from '../services/aiService';
import ObjectDetectionView from '../components/ObjectDetectionView';
import SegmentationView from '../components/SegmentationView';

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
  const [tabValue, setTabValue] = useState(0); // Start with Basic Info tab

  // ML Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingType, setAnalyzingType] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  
  // Detailed results states
  const [detailedResults, setDetailedResults] = useState<{
    objectDetection?: ObjectDetectionResult;
    segmentation?: SegmentationResult;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState<{
    objectDetection?: boolean;
    segmentation?: boolean;
  }>({});

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
    setAnalyzingType(analysisType);
    setAnalysisError(null);
    // Clear any existing detailed results for this analysis type
    if (analysisType === 'detection') {
      setDetailedResults(prev => ({ ...prev, objectDetection: undefined }));
      setFetchAttempted(prev => ({ ...prev, objectDetection: false }));
    } else if (analysisType === 'segmentation') {
      setDetailedResults(prev => ({ ...prev, segmentation: undefined }));
      setFetchAttempted(prev => ({ ...prev, segmentation: false }));
    }
    
    try {
      let response;
      
      switch (analysisType) {
        case 'detection':
          response = await aiService.detectObjects(photo._id, {
            confidenceThreshold: 0.25,
            createVisualization: true
          });
          // Update photo with AI analysis reference
          if (response.success) {
            await photoService.updatePhotoAIAnalysis(photo._id, {
              analysisType: 'objectDetection',
              resultId: response.result_id,
              totalDetections: response.total_detections,
              processingTime: response.processing_time
            });
          }
          break;
        case 'segmentation':
          response = await aiService.segmentImage(photo._id, {
            multimaskOutput: true
          });
          // Update photo with AI analysis reference
          if (response.success) {
            await photoService.updatePhotoAIAnalysis(photo._id, {
              analysisType: 'segmentation',
              resultId: response.result_id,
              totalMasks: response.total_masks,
              segmentationType: response.segmentation_type,
              processingTime: response.processing_time
            });
          }
          break;
        default:
          throw new Error(`Analysis type "${analysisType}" is not yet implemented`);
      }
      
      setAnalysisResults({
        type: analysisType,
        timestamp: new Date().toISOString(),
        results: response
      });

      // Refresh photo data to get updated AI analysis
      const updatedPhoto = await photoService.getPhotoById(photo._id);
      setPhoto(updatedPhoto.data);
      
    } catch (err) {
      if (err instanceof AIServiceError) {
        setAnalysisError(`${err.service} service error: ${err.message}`);
      } else {
        setAnalysisError(`Failed to run ${analysisType} analysis: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      console.error(`${analysisType} analysis error:`, err);
    } finally {
      setIsAnalyzing(false);
      setAnalyzingType(null);
    }
  };

  const fetchDetailedResults = async (analysisType: 'objectDetection' | 'segmentation', resultId: string) => {
    setLoadingDetails(analysisType);
    setAnalysisError(null);
    
    // Mark that we've attempted to fetch this result
    setFetchAttempted(prev => ({ ...prev, [analysisType]: true }));
    
    try {
      if (analysisType === 'objectDetection') {
        const result = await aiService.getObjectDetectionResult(resultId);
        setDetailedResults(prev => ({ ...prev, objectDetection: result }));
      } else if (analysisType === 'segmentation') {
        const result = await aiService.getSegmentationResult(resultId);
        setDetailedResults(prev => ({ ...prev, segmentation: result }));
      }
    } catch (err) {
      // Just log the error and set a simple error message
      console.error('Error fetching detailed results:', err);
      setAnalysisError(`Unable to load detailed analysis results. The results may no longer be available.`);
    } finally {
      setLoadingDetails(null);
    }
  };

  const handleRunObjectDetection = async () => {
    await handleRunAnalysis('detection');
  };

  const handleRunSegmentation = async () => {
    await handleRunAnalysis('segmentation');
  };

  const checkServicesHealth = async () => {
    setCheckingHealth(true);
    try {
      const health = await aiService.checkAllServicesHealth();
      setHealthStatus(health);
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthStatus({
        segmentation: false,
        objectDetection: false,
        lastChecked: new Date()
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  // Check health when component mounts
  useEffect(() => {
    checkServicesHealth();
  }, []);

  // Auto-fetch detailed results when photo analysis data is available
  useEffect(() => {
    if (photo?.aiAnalysis?.objectDetection?.resultId && 
        !detailedResults?.objectDetection && 
        loadingDetails !== 'objectDetection' &&
        !fetchAttempted.objectDetection) {
      fetchDetailedResults('objectDetection', photo.aiAnalysis.objectDetection.resultId);
    }
  }, [photo?.aiAnalysis?.objectDetection?.resultId, detailedResults?.objectDetection, loadingDetails, fetchAttempted.objectDetection]);

  useEffect(() => {
    if (photo?.aiAnalysis?.segmentation?.resultId && 
        !detailedResults?.segmentation && 
        loadingDetails !== 'segmentation' &&
        !fetchAttempted.segmentation) {
      fetchDetailedResults('segmentation', photo.aiAnalysis.segmentation.resultId);
    }
  }, [photo?.aiAnalysis?.segmentation?.resultId, detailedResults?.segmentation, loadingDetails, fetchAttempted.segmentation]);

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

      {/* Main Content with Tabs */}
      <Box>
        <Paper elevation={2}>
          {/* Header */}
          <Box>
            {analysisResults && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Latest Analysis Results ({analysisResults.type})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Completed at: {formatDate(analysisResults.timestamp)}
                  </Typography>
                  
                  {analysisResults.results.success && (
                    <Box>
                      <Typography variant="body1" gutterBottom>
                        Analysis completed successfully!
                      </Typography>
                      
                      {analysisResults.type === 'detection' && (
                        <Box>
                          <Typography variant="body2">
                            • Found {analysisResults.results.total_detections} objects
                          </Typography>
                          <Typography variant="body2">
                            • Processing time: {analysisResults.results.processing_time?.toFixed(2)}s
                          </Typography>
                          <Typography variant="body2">
                            • Image dimensions: {analysisResults.results.image_dimensions?.width} × {analysisResults.results.image_dimensions?.height}
                          </Typography>
                        </Box>
                      )}
                      
                      {analysisResults.type === 'segmentation' && (
                        <Box>
                          <Typography variant="body2">
                            • Generated {analysisResults.results.total_masks} masks
                          </Typography>
                          <Typography variant="body2">
                            • Segmentation type: {analysisResults.results.segmentation_type}
                          </Typography>
                          <Typography variant="body2">
                            • Processing time: {analysisResults.results.processing_time?.toFixed(2)}s
                          </Typography>
                          <Typography variant="body2">
                            • Image dimensions: {analysisResults.results.image_dimensions?.width} × {analysisResults.results.image_dimensions?.height}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Main Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab 
                label="Basic Info" 
                icon={<InfoIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="Object Detection" 
                icon={<SmartToyIcon />} 
                iconPosition="start"
              />
              <Tab 
                label="Segmentation" 
                icon={<ViewInArIcon />} 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            {/* Basic Info - Photo and Details Combined */}
            <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
              {/* Photo Display */}
              <Box sx={{ flex: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Photo
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
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
                </Box>
              </Box>

              {/* Photo Details */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Details
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
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ObjectDetectionView
              photo={photo}
              detailedResults={detailedResults?.objectDetection}
              loadingDetails={loadingDetails}
              analysisError={analysisError}
              healthStatus={healthStatus}
              checkingHealth={checkingHealth}
              isAnalyzing={isAnalyzing && analyzingType === 'detection'}
              onClearDetails={() => setDetailedResults(prev => ({ ...prev, objectDetection: undefined }))}
              onRunAnalysis={handleRunObjectDetection}
              onCheckHealth={checkServicesHealth}
              formatDate={formatDate}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <SegmentationView
              photo={photo}
              detailedResults={detailedResults?.segmentation}
              loadingDetails={loadingDetails}
              analysisError={analysisError}
              healthStatus={healthStatus}
              checkingHealth={checkingHealth}
              isAnalyzing={isAnalyzing && analyzingType === 'segmentation'}
              onClearDetails={() => setDetailedResults(prev => ({ ...prev, segmentation: undefined }))}
              onRunAnalysis={handleRunSegmentation}
              onCheckHealth={checkServicesHealth}
              formatDate={formatDate}
            />
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
