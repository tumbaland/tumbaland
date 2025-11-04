import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardMedia,
  CardContent,
  CircularProgress,
  Alert,
  Paper,
  LinearProgress,
  TextField
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DatasetImage,
  getAllImages,
  updateDatasetImage
} from '../services/datasetImageService';

const ImageLabelingPage: React.FC = () => {
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [labeling, setLabeling] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [setupMode, setSetupMode] = useState(true);
  const [imageLimit, setImageLimit] = useState(100);

  const queryClient = useQueryClient();

  // Get overall labeling metrics
  const { data: labelingMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['overallLabelingMetrics'],
    queryFn: async () => {
      // Get all images to calculate metrics
      const response = await getAllImages(1, undefined); // No limit to get all images
      const images = response.data.images;
      
      let goodCount = 0;
      let badCount = 0;
      let unlabeledCount = 0;
      
      images.forEach((image: DatasetImage) => {
        const hasGoodLabel = image.tags.some(tag => 
          tag.toLowerCase().includes('good') || tag === 'good_annotations'
        );
        const hasBadLabel = image.tags.some(tag => 
          tag.toLowerCase().includes('bad') || tag === 'bad_annotations'
        );
        
        if (hasGoodLabel) {
          goodCount++;
        } else if (hasBadLabel) {
          badCount++;
        } else {
          unlabeledCount++;
        }
      });
      
      return {
        total: images.length,
        good: goodCount,
        bad: badCount,
        unlabeled: unlabeledCount,
        goodPercentage: images.length > 0 ? Math.round((goodCount / images.length) * 100) : 0,
        badPercentage: images.length > 0 ? Math.round((badCount / images.length) * 100) : 0,
        unlabeledPercentage: images.length > 0 ? Math.round((unlabeledCount / images.length) * 100) : 0
      };
    },
    retry: false,
  });

  const startLabeling = async () => {
    if (imageLimit < 1) {
      showAlert('error', 'Please enter a number greater than 0');
      return;
    }

    setLoading(true);
    setSetupMode(false);

    try {
      // Try to load all images first
      console.log('Loading all images...');
      const response = await getAllImages(1, 1000);
      console.log('getAllImages response:', response);
      
      if (response.success && response.data.images) {
        const allImages = response.data.images;
        console.log('Total images found:', allImages.length);
        
        // Filter for unlabeled images (images with no tags)
        const unlabeledImages = allImages.filter((image: DatasetImage) => 
          !image.tags || image.tags.length === 0
        );
        console.log('Unlabeled images found:', unlabeledImages.length);
        
        if (unlabeledImages.length > 0) {
          // Take only the requested number of images
          const selectedImages = unlabeledImages.slice(0, imageLimit);
          console.log('Selected images for labeling:', selectedImages.length);
          
          setImages(selectedImages);
          setCurrentImageIndex(0);
          return;
        }
      }
      
      // If getAllImages didn't work or returned no images, show a message
      console.log('No images found via getAllImages, trying alternative approach...');
      showAlert('info', 'No unlabeled images found in the system. Please upload some images first.');
      setSetupMode(true);
      
    } catch (error) {
      console.error('Error loading images:', error);
      showAlert('error', 'Failed to load images for labeling. Please check that images exist in the system.');
      setSetupMode(true);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleLabel = async (label: 'good' | 'bad') => {
    if (!currentImage || labeling) return;

    setLabeling(true);
    try {
      const image = currentImage;
      const updatedTags = [...image.tags];

      // Remove existing good/bad tags if any
      const filteredTags = updatedTags.filter(tag => tag !== 'good' && tag !== 'bad');

      // Add the new label
      filteredTags.push(label);

      await updateDatasetImage(image._id, { tags: filteredTags });

      // Update local state
      setImages(images.map(img =>
        img._id === image._id ? { ...img, tags: filteredTags } : img
      ));

      // Move to next image or finish
      if (currentImageIndex < images.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else {
        // Session completed - return to setup mode to see stats and start new session
        resetLabeling();
      }
    } catch (error) {
      showAlert('error', 'Failed to save label');
    } finally {
      setLabeling(false);
    }
  };

  const handleSkip = () => {
    // Move to next image or finish
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // Session completed - return to setup mode to see stats and start new session
      resetLabeling();
    }
  };

  const resetLabeling = () => {
    setSetupMode(true);
    setImages([]);
    setCurrentImageIndex(0);
    setAlert(null);
    // Refresh statistics when returning to setup mode
    queryClient.invalidateQueries({ queryKey: ['overallLabelingMetrics'] });
  };

  const currentImage = images[currentImageIndex];
  const progress = images.length > 0 ? ((currentImageIndex + 1) / images.length) * 100 : 0;

  // Setup Mode
  if (setupMode) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          {/* Labeling Progress Overview */}
          {metricsLoading ? (
            <Paper sx={{ p: 3, mb: 4, backgroundColor: '#f8f9fa' }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography variant="body1">Loading statistics...</Typography>
              </Box>
            </Paper>
          ) : labelingMetrics ? (
            <Paper sx={{ p: 3, mb: 4, backgroundColor: '#f8f9fa' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Overall Labeling Progress
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {labelingMetrics.good.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    Good ({labelingMetrics.goodPercentage}%)
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {labelingMetrics.bad.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    Bad ({labelingMetrics.badPercentage}%)
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="h4" color="warning.main" fontWeight="bold">
                    {labelingMetrics.unlabeled.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    Unlabeled ({labelingMetrics.unlabeledPercentage}%)
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', minWidth: 120 }}>
                  <Typography variant="h4" color="primary.main" fontWeight="bold">
                    {labelingMetrics.total.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="primary.main">
                    Total Images
                  </Typography>
                </Box>
              </Box>
              
              {/* Progress Bar */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Labeling Completion: {labelingMetrics.good + labelingMetrics.bad} / {labelingMetrics.total} 
                  ({Math.round(((labelingMetrics.good + labelingMetrics.bad) / labelingMetrics.total) * 100)}%)
                </Typography>
                <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <Box 
                    sx={{ 
                      backgroundColor: 'success.main', 
                      width: `${(labelingMetrics.good / labelingMetrics.total) * 100}%` 
                    }} 
                  />
                  <Box 
                    sx={{ 
                      backgroundColor: 'error.main', 
                      width: `${(labelingMetrics.bad / labelingMetrics.total) * 100}%` 
                    }} 
                  />
                  <Box 
                    sx={{ 
                      backgroundColor: 'warning.main', 
                      width: `${(labelingMetrics.unlabeled / labelingMetrics.total) * 100}%` 
                    }} 
                  />
                </Box>
              </Box>
            </Paper>
          ) : null}

          <Box sx={{ textAlign: 'center' }}>
            <Paper elevation={2} sx={{ p: 4, mb: 3, maxWidth: 400, mx: 'auto' }}>
              <Typography variant="h5" sx={{ mb: 3 }}>
                Image Labeling Setup
              </Typography>
              
              <TextField
                fullWidth
                type="number"
                label="Number of images to label"
                value={imageLimit}
                onChange={(e) => setImageLimit(Math.max(1, Number(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                sx={{ mb: 3 }}
                helperText="Maximum number of unlabeled images to load for this session"
              />

              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={startLabeling}
                disabled={loading || imageLimit < 1}
                fullWidth
                sx={{ py: 2 }}
              >
                {loading ? 'Loading Images...' : `Start Labeling`}
              </Button>
            </Paper>

            {alert && (
              <Alert severity={alert.type} sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                {alert.message}
              </Alert>
            )}
          </Box>
        </Box>
      </Container>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading {imageLimit} images for labeling...
          </Typography>
        </Box>
      </Container>
    );
  }

  // No images state
  if (images.length === 0) {
    return (
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="text.secondary">
            No images available for labeling
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Please check that images exist in the dataset.
          </Typography>
          <Button variant="outlined" onClick={resetLabeling} sx={{ mt: 2 }}>
            Back to Setup
          </Button>
        </Box>
      </Container>
    );
  }

  // Labeling interface
  return (
    <Box sx={{ width: '100vw', height: '90vh', p: 0, m: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Fixed height */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 0.5, flexShrink: 0, minHeight: 40 }}>
        <div></div>
        <Button variant="outlined" onClick={resetLabeling} size="small">
          Change Settings
        </Button>
      </Box>

      {/* Progress Bar - Fixed height */}
      <Box sx={{ px: 2, pb: 0.5, flexShrink: 0 }}>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 0.25 }}>
          Progress: {currentImageIndex + 1} of {images.length} images
        </Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
      </Box>

      {/* Image Area - Takes remaining space but leaves room for buttons */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'calc(100vh - 200px)' }}>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', px: 2, pb: 1, minHeight: 0 }}>
          <Card sx={{ width: '100%', height: '100%', boxShadow: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardMedia
              component="img"
              sx={{ flex: 1, objectFit: 'contain', minHeight: 0 }}
              image={currentImage.signedUrl || currentImage.thumbnailSignedUrl}
              alt={currentImage.title || currentImage.originalName}
            />
            <CardContent sx={{ pb: 0.5, pt: 0.5, flexShrink: 0 }}>
              <Typography variant="h6" align="center" sx={{ fontSize: '1rem', mb: 0.25 }}>
                {currentImage.title || currentImage.originalName}
              </Typography>
              {currentImage.description && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ fontSize: '0.9rem', mb: 0.25 }}>
                  {currentImage.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.25 }}>
                {currentImage.tags.map((tag) => (
                  <Typography key={tag} variant="caption" sx={{
                    mx: 0.3,
                    px: 0.8,
                    py: 0.3,
                    bgcolor: tag === 'good' ? 'success.light' : tag === 'bad' ? 'error.light' : 'grey.300',
                    borderRadius: 1,
                    color: 'white',
                    fontSize: '0.7rem'
                  }}>
                    {tag}
                  </Typography>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Labeling Buttons - Fixed at bottom, always visible */}
      <Box sx={{ flexShrink: 0, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: labeling ? 0.5 : 0 }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<ThumbUpIcon />}
            onClick={() => handleLabel('good')}
            disabled={labeling}
            sx={{ minWidth: 100, py: 1.5, fontSize: '0.9rem' }}
          >
            Good
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => handleSkip()}
            disabled={labeling}
            sx={{ minWidth: 100, py: 1.5, fontSize: '0.9rem' }}
          >
            Skip
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<ThumbDownIcon />}
            onClick={() => handleLabel('bad')}
            disabled={labeling}
            sx={{ minWidth: 100, py: 1.5, fontSize: '0.9rem' }}
          >
            Bad
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ImageLabelingPage;