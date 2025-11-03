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
        showAlert('success', `All ${images.length} images have been labeled!`);
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
      showAlert('success', `All ${images.length} images have been reviewed!`);
    }
  };

  const resetLabeling = () => {
    setSetupMode(true);
    setImages([]);
    setCurrentImageIndex(0);
    setAlert(null);
  };

  const currentImage = images[currentImageIndex];
  const progress = images.length > 0 ? ((currentImageIndex + 1) / images.length) * 100 : 0;

  // Setup Mode
  if (setupMode) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Paper elevation={2} sx={{ p: 4, mb: 3 }}>
            <TextField
              fullWidth
              type="number"
              label="Number of images to label"
              value={imageLimit}
              onChange={(e) => setImageLimit(Math.max(1, Number(e.target.value) || 1))}
              inputProps={{ min: 1 }}
              sx={{ mb: 3 }}
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
            <Alert severity={alert.type} sx={{ mb: 3 }}>
              {alert.message}
            </Alert>
          )}
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
    <Box sx={{ width: '100vw', height: '100vh', p: 0, m: 0, overflow: 'hidden' }}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 2, pt: 1 }}>
          <div></div>
          <Button variant="outlined" onClick={resetLabeling} size="small">
            Change Settings
          </Button>
        </Box>

        {alert && (
          <Box sx={{ px: 2, mb: 1 }}>
            <Alert severity={alert.type}>
              {alert.message}
            </Alert>
          </Box>
        )}

        {/* Progress Bar */}
        <Box sx={{ px: 2, mb: 1 }}>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 0.5 }}>
            Progress: {currentImageIndex + 1} of {images.length} images
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
        </Box>

        {/* Current Image - Takes up most of the space */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', px: 2, pb: 1, minHeight: 0 }}>
          <Card sx={{ width: '100%', height: '100%', boxShadow: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardMedia
              component="img"
              sx={{ flex: 1, objectFit: 'contain', minHeight: 0 }}
              image={currentImage.signedUrl || currentImage.thumbnailSignedUrl}
              alt={currentImage.title || currentImage.originalName}
            />
            <CardContent sx={{ pb: 1, pt: 1 }}>
              <Typography variant="h6" align="center" sx={{ fontSize: '1rem' }}>
                {currentImage.title || currentImage.originalName}
              </Typography>
              {currentImage.description && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ fontSize: '0.9rem' }}>
                  {currentImage.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
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

        {/* Labeling Buttons - Fixed at bottom */}
        <Box sx={{ px: 2, pb: 2, pt: 1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<ThumbUpIcon />}
              onClick={() => handleLabel('good')}
              disabled={labeling}
              sx={{ minWidth: 120, py: 2, fontSize: '1rem' }}
            >
              Good
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSkip()}
              disabled={labeling}
              sx={{ minWidth: 120, py: 2, fontSize: '1rem' }}
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
              sx={{ minWidth: 120, py: 2, fontSize: '1rem' }}
            >
              Bad
            </Button>
          </Box>

          {labeling && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ ml: 1 }}>
                Saving label...
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ImageLabelingPage;