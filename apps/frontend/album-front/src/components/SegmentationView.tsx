import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Alert
} from '@mui/material';
import { Close as CloseIcon, CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { SegmentationResult, HealthStatus, segmentationService } from '../services/segmentationService';
import { albumService } from '../services/albumService';
import { Photo } from '../types';

interface SegmentationViewNewProps {
  photo: Photo;
  formatDate: (dateString: string) => string;
  onAnalysisComplete?: () => void;
}

const SegmentationView: React.FC<SegmentationViewNewProps> = ({ photo, formatDate, onAnalysisComplete }) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [detailedResults, setDetailedResults] = useState<SegmentationResult | undefined>(undefined);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Health check logic
  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const health = await segmentationService.checkAllServicesHealth();
      setHealthStatus(health);
    } catch (err) {
      setHealthStatus({ segmentation: false, lastChecked: new Date() });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Always fetch latest segmentation job details when tab is opened
    const jobId = photo?.aiAnalysis?.segmentation?.jobId;
    if (jobId) {
      (async () => {
        setLoadingDetails('segmentation');
        setAnalysisError(null);
        try {
          // Always fetch latest job details from backend
          const jobResult = await segmentationService.getSegmentationResult(jobId);
          setDetailedResults(jobResult as SegmentationResult);
        } catch (err) {
          setAnalysisError('Unable to load detailed analysis results. The results may no longer be available.');
        } finally {
          setLoadingDetails(null);
        }
      })();
    } else {
      setDetailedResults(undefined);
    }
     
  }, [photo]);

  // Run segmentation analysis
  const runAnalysis = async () => {
    if (!photo) return;
    
    // Only allow segmentation on image files
    if (!photo.mimetype.startsWith('image/')) {
      setAnalysisError('Segmentation is only available for image files.');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    setDetailedResults(undefined);
    try {
      const response = await segmentationService.segmentImage(photo._id, {});
      if (response.success) {
        setDetailedResults(response as SegmentationResult);

        // Update backend photo analysis info with new jobId using albumService
        await albumService.updatePhotoAIAnalysis(photo._id, {
          analysisType: 'segmentation',
          jobId: response.job_id,
          totalMasks: response.total_masks,
          segmentationType: response.segmentation_type,
          processingTime: response.processing_time
        });
        // Notify parent to refetch photo
        if (onAnalysisComplete) {
          onAnalysisComplete();
        }
      }
    } catch (err) {
      setAnalysisError('Failed to run segmentation analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load detailed results
  const loadDetails = async () => {
    if (!photo?.aiAnalysis?.segmentation?.jobId) return;
    setLoadingDetails('segmentation');
    setAnalysisError(null);
    try {
      const jobResult = await segmentationService.getSegmentationResult(photo.aiAnalysis.segmentation.jobId);
      setDetailedResults(jobResult as SegmentationResult);
    } catch (err) {
      setAnalysisError('Unable to load detailed analysis results. The results may no longer be available.');
    } finally {
      setLoadingDetails(null);
    }
  };

  // Clear details
  const clearDetails = () => {
    setDetailedResults(undefined);
  };

  return (
    <Box>
      {/* Service Health Status */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Segmentation Service Status</Typography>
            <Button
              size="small"
              onClick={checkHealth}
              disabled={checkingHealth}
            >
              {checkingHealth ? <CircularProgress size={16} /> : 'Refresh'}
            </Button>
          </Box>
          {healthStatus && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                icon={healthStatus.segmentation ? <CheckCircleIcon /> : <WarningIcon />}
                label={`Segmentation: ${healthStatus.segmentation ? 'Online' : 'Offline'}`}
                color={healthStatus.segmentation ? 'success' : 'error'}
                variant="outlined"
              />
            </Box>
          )}
          {healthStatus && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mt: 1,
                display: 'block'
              }}>
              Last checked: {healthStatus.lastChecked.toLocaleString()}
            </Typography>
          )}
        </CardContent>
      </Card>
      {/* Analysis Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={runAnalysis}
          disabled={isAnalyzing || !healthStatus?.segmentation}
          startIcon={isAnalyzing && <CircularProgress size={16} />}
          fullWidth
        >
          {photo.aiAnalysis?.segmentation ? 'Re-run ' : ''}Semantic Segmentation
        </Button>
        {isAnalyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <CircularProgress size={24} />
            <Typography>Running segmentation analysis... This may take a minute.</Typography>
          </Box>
        )}
      </Box>
      {/* Error Display */}
      {analysisError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {analysisError}
        </Alert>
      )}
      {/* Previous Analysis Results */}
      {photo.aiAnalysis?.segmentation && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Previous Segmentation Analysis
            </Typography>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Analyzed: {formatDate(photo.aiAnalysis.segmentation.analyzedAt)}
            </Typography>
            <Typography variant="body2">
              Generated {photo.aiAnalysis.segmentation.totalMasks} masks 
              ({photo.aiAnalysis.segmentation.segmentationType} segmentation, 
              Processing time: {photo.aiAnalysis.segmentation.processingTime.toFixed(2)}s)
            </Typography>
            {!detailedResults && (
              <Button
                size="small"
                variant="outlined"
                onClick={loadDetails}
                sx={{ mt: 1 }}
                disabled={loadingDetails === 'segmentation'}
              >
                {loadingDetails === 'segmentation' ? 'Loading...' : 'View Details'}
              </Button>
            )}
            {loadingDetails === 'segmentation' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Loading detailed results...</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      {/* Detailed Results */}
      {detailedResults && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Segmentation Details
              </Typography>
              <IconButton size="small" onClick={clearDetails}>
                <CloseIcon />
              </IconButton>
            </Box>
            {/* Responsive layout: image left, masks right (row on desktop, column on mobile) */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              {/* Segmentation Visualization */}
              <Box sx={{ flex: 1, mb: { xs: 2, md: 0 } }}>
                <Typography variant="subtitle2" gutterBottom>
                  Segmentation Visualization
                </Typography>
                {detailedResults.job_id ? (
                  <Box
                    component="img"
                    src={segmentationService.getSegmentationVisualizationUrl(detailedResults.job_id)}
                    alt="Segmentation Visualization"
                    sx={{
                      width: '100%',
                      maxWidth: 350,
                      height: 'auto',
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.8 }
                    }}
                    onClick={() => {
                      const imageUrl = segmentationService.getSegmentationVisualizationUrl(detailedResults.job_id);
                      window.open(imageUrl, '_self');
                    }}
                  />
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    No visualization available for this segmentation result.
                  </Typography>
                )}
                {/* Analysis Summary */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Analysis Summary
                  </Typography>
                  <Typography variant="body2">Segmentation Type: {detailedResults.segmentation_type}</Typography>
                  <Typography variant="body2">Model: {detailedResults.model_name}</Typography>
                  <Typography variant="body2">Processing Time: {detailedResults.processing_time?.toFixed(2)}s</Typography>
                  {detailedResults.image_dimensions && (
                    <Typography variant="body2">
                      Image Dimensions: {detailedResults.image_dimensions.width} × {detailedResults.image_dimensions.height}
                    </Typography>
                  )}
                  <Typography variant="body2">Total Masks: {detailedResults.total_masks}</Typography>
                </Box>
              </Box>
              {/* Individual Masks */}
              <Box sx={{ flex: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Individual Masks
                </Typography>
                {detailedResults.masks && detailedResults.masks.length > 0 ? (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {detailedResults.masks.map((mask, idx) => (
                      <Card key={idx} variant="outlined" sx={{ mb: 1, p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body1" sx={{
                              fontWeight: "bold"
                            }}>
                              Mask {idx + 1}
                            </Typography>
                            <Typography variant="body2" sx={{
                              color: "text.secondary"
                            }}>
                              Area: {mask.area.toLocaleString()} pixels
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip label={`IoU: ${mask.predicted_iou.toFixed(2)}`} color={mask.predicted_iou > 0.8 ? 'success' : mask.predicted_iou > 0.5 ? 'warning' : 'default'} size="small" />
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Bounding Box: ({mask.bbox[0].toFixed(1)}, {mask.bbox[1].toFixed(1)}) - {mask.bbox[2].toFixed(1)} × {mask.bbox[3].toFixed(1)}
                        </Typography>
                        {mask.mask_file_path && detailedResults.job_id && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" gutterBottom>
                              Mask Visualization:
                            </Typography>
                            <Box
                              component="img"
                              src={segmentationService.getSegmentationMaskUrl(detailedResults.job_id, mask.mask_file_path.split('/').pop() || '')}
                              alt={`Mask ${idx + 1}`}
                              sx={{
                                width: '100%',
                                maxWidth: 200,
                                height: 'auto',
                                borderRadius: 1,
                                border: '1px solid #e0e0e0',
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                              onClick={() => {
                                const maskUrl = segmentationService.getSegmentationMaskUrl(detailedResults.job_id, mask.mask_file_path.split('/').pop() || '');
                                window.open(maskUrl, '_self');
                              }}
                            />
                          </Box>
                        )}
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    No individual mask data available.
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
      {/* No Analysis Message */}
      {!photo.aiAnalysis?.segmentation && !detailedResults && (
        <Card variant="outlined">
          <CardContent>
            <Typography
              variant="body1"
              align="center"
              sx={{
                color: "text.secondary",
                py: 4
              }}>
              No segmentation analysis has been performed on this image yet.
              Use the "Semantic Segmentation" button above to run analysis.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SegmentationView;
