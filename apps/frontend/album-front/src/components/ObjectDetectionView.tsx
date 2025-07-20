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
import { ObjectDetectionResult, HealthStatus, aiService } from '../services/aiService';

interface ObjectDetectionViewNewProps {
  photo: any;
  formatDate: (dateString: string) => string;
}

const ObjectDetectionView: React.FC<ObjectDetectionViewNewProps> = ({ photo, formatDate }) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [detailedResults, setDetailedResults] = useState<ObjectDetectionResult | undefined>(undefined);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  // Health check logic
  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const health = await aiService.checkAllServicesHealth();
      setHealthStatus(health);
    } catch (err) {
      setHealthStatus({ segmentation: false, objectDetection: false, lastChecked: new Date() });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // If previous analysis exists, fetch its details automatically
    if (photo?.aiAnalysis?.objectDetection?.resultId) {
      (async () => {
        setLoadingDetails('objectDetection');
        setAnalysisError(null);
        try {
          const jobResult = await aiService.getObjectDetectionResult(photo.aiAnalysis.objectDetection.resultId);
          setDetailedResults(jobResult as ObjectDetectionResult);
        } catch (err) {
          setAnalysisError('Unable to load detailed analysis results. The results may no longer be available.');
        } finally {
          setLoadingDetails(null);
        }
      })();
    }
  }, [photo?.aiAnalysis?.objectDetection?.resultId]);

  // Run object detection analysis
  const runAnalysis = async () => {
    if (!photo) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setDetailedResults(undefined);
    try {
      const response = await aiService.detectObjects(photo._id, {});
      if (response.success) {
        setDetailedResults(response as unknown as ObjectDetectionResult);
      }
    } catch (err) {
      setAnalysisError('Failed to run object detection analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load detailed results
  const loadDetails = async () => {
    if (!photo?.aiAnalysis?.objectDetection?.resultId) return;
    setLoadingDetails('objectDetection');
    setAnalysisError(null);
    try {
      const jobResult = await aiService.getObjectDetectionResult(photo.aiAnalysis.objectDetection.resultId);
      setDetailedResults(jobResult as ObjectDetectionResult);
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
            <Typography variant="h6">Object Detection Service Status</Typography>
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
                icon={healthStatus.objectDetection ? <CheckCircleIcon /> : <WarningIcon />}
                label={`Object Detection: ${healthStatus.objectDetection ? 'Online' : 'Offline'}`}
                color={healthStatus.objectDetection ? 'success' : 'error'}
                variant="outlined"
              />
            </Box>
          )}
          {healthStatus && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
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
          disabled={isAnalyzing || !healthStatus?.objectDetection}
          startIcon={isAnalyzing && <CircularProgress size={16} />}
          fullWidth
        >
          {photo.aiAnalysis?.objectDetection ? 'Re-run ' : ''}Object Detection
        </Button>
        {isAnalyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <CircularProgress size={24} />
            <Typography>Running object detection analysis... This may take a minute.</Typography>
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
      {photo.aiAnalysis?.objectDetection && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Previous Object Detection Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Analyzed: {formatDate(photo.aiAnalysis.objectDetection.analyzedAt)}
            </Typography>
            <Typography variant="body2">
              Detected {photo.aiAnalysis.objectDetection.totalObjects} objects
              (Model: {photo.aiAnalysis.objectDetection.modelName}, Processing time: {photo.aiAnalysis.objectDetection.processingTime.toFixed(2)}s)
            </Typography>
            {!detailedResults && (
              <Button
                size="small"
                variant="outlined"
                onClick={loadDetails}
                sx={{ mt: 1 }}
                disabled={loadingDetails === 'objectDetection'}
              >
                {loadingDetails === 'objectDetection' ? 'Loading...' : 'View Details'}
              </Button>
            )}
            {loadingDetails === 'objectDetection' && (
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
                Object Detection Details
              </Typography>
              <IconButton size="small" onClick={clearDetails}>
                <CloseIcon />
              </IconButton>
            </Box>
            {/* Responsive layout: image left, detected objects right (row on desktop, column on mobile) */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              {/* Visualization Image */}
              {detailedResults.visualization_path && (
                <Box sx={{ flex: 1, mb: { xs: 2, md: 0 } }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Detection Visualization
                  </Typography>
                  <Box
                    component="img"
                    src={detailedResults.visualization_path ? aiService.getVisualizationImageUrl(detailedResults.visualization_path) : ''}
                    alt="Detection Visualization"
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
                      if (detailedResults.visualization_path) {
                        const imageUrl = aiService.getVisualizationImageUrl(detailedResults.visualization_path);
                        window.open(imageUrl, '_blank');
                      }
                    }}
                  />
                  {/* Analysis Summary */}
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Analysis Summary
                    </Typography>
                    <Typography variant="body2">Model: {detailedResults.model_name}</Typography>
                    <Typography variant="body2">Confidence Threshold: {detailedResults.confidence_threshold}</Typography>
                    <Typography variant="body2">Processing Time: {detailedResults.processing_time?.toFixed(2)}s</Typography>
                    {detailedResults.image_dimensions && (
                      <Typography variant="body2">
                        Image Dimensions: {detailedResults.image_dimensions.width} × {detailedResults.image_dimensions.height}
                      </Typography>
                    )}
                    <Typography variant="body2">Total Detections: {detailedResults.total_detections}</Typography>
                  </Box>
                </Box>
              )}
              {/* Detected Objects */}
              <Box sx={{ flex: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detected Objects
                </Typography>
                {detailedResults.detections && detailedResults.detections.length > 0 ? (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {detailedResults.detections.map((det, idx) => (
                      <Card key={idx} variant="outlined" sx={{ mb: 1, p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body1" fontWeight="bold">
                              {det.class_name} (ID: {det.class_id})
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Confidence: {(det.confidence * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip label={`Confidence: ${(det.confidence * 100).toFixed(1)}%`} color={det.confidence > 0.8 ? 'success' : det.confidence > 0.5 ? 'warning' : 'default'} size="small" />
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Bounding Box: x1={det.bbox.x1.toFixed(1)}, y1={det.bbox.y1.toFixed(1)}, x2={det.bbox.x2.toFixed(1)}, y2={det.bbox.y2.toFixed(1)}
                          (width: {det.bbox.width.toFixed(1)}, height: {det.bbox.height.toFixed(1)})
                        </Typography>
                        <Typography variant="body2">
                          Center Point: ({det.center_point[0].toFixed(1)}, {det.center_point[1].toFixed(1)})
                        </Typography>
                      </Card>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No detected objects found.
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
      {/* No Analysis Message */}
      {!photo.aiAnalysis?.objectDetection && !detailedResults && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
              No object detection analysis has been performed on this image yet.
              Use the "Object Detection" button above to run analysis.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ObjectDetectionView;
