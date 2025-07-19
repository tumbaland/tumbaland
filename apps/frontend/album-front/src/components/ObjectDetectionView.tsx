import React from 'react';
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
import { ObjectDetectionResult, Detection, HealthStatus, aiService } from '../services/aiService';

interface ObjectDetectionViewProps {
  photo: any;
  detailedResults: ObjectDetectionResult | undefined;
  loadingDetails: string | null;
  analysisError: string | null;
  healthStatus: HealthStatus | null;
  checkingHealth: boolean;
  isAnalyzing: boolean;
  onClearDetails: () => void;
  onRunAnalysis: () => void;
  onCheckHealth: () => void;
  formatDate: (dateString: string) => string;
}

const ObjectDetectionView: React.FC<ObjectDetectionViewProps> = ({
  photo,
  detailedResults,
  loadingDetails,
  analysisError,
  healthStatus,
  checkingHealth,
  isAnalyzing,
  onClearDetails,
  onRunAnalysis,
  onCheckHealth,
  formatDate
}) => {
  return (
    <Box>
      {/* Service Health Status */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Object Detection Service Status</Typography>
            <Button
              size="small"
              onClick={onCheckHealth}
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
          onClick={onRunAnalysis}
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
              Found {photo.aiAnalysis.objectDetection.totalDetections} objects 
              (Processing time: {photo.aiAnalysis.objectDetection.processingTime.toFixed(2)}s)
            </Typography>
            {loadingDetails === 'objectDetection' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Loading detailed results...</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {analysisError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {analysisError}
        </Alert>
      )}

      {/* Detailed Results */}
      {(detailedResults || (photo.aiAnalysis?.objectDetection && loadingDetails === 'objectDetection')) && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Object Detection Details
              </Typography>
              {detailedResults && (
                <IconButton size="small" onClick={onClearDetails}>
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
            
            {loadingDetails === 'objectDetection' && !detailedResults && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
                <CircularProgress size={24} />
                <Typography>Loading detailed results...</Typography>
              </Box>
            )}

            {detailedResults && (
              <>
                {/* Visualization Images Section */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    🎯 Object Detection Results
                  </Typography>
                  
                  {detailedResults.visualization_path ? (
                    <>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Image with detected objects highlighted by bounding boxes
                      </Typography>
                      
                      {/* Before/After Comparison */}
                      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                        {/* Original Image */}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight="bold" gutterBottom>
                            Original Image
                          </Typography>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              justifyContent: 'center', 
                              p: 2, 
                              border: '2px solid #e0e0e0', 
                              borderRadius: 2,
                              backgroundColor: '#f9f9f9'
                            }}
                          >
                            <Box
                              component="img"
                              src={photo.signedUrl}
                              alt="Original Image"
                              sx={{
                                width: '100%',
                                maxWidth: 400,
                                height: 'auto',
                                borderRadius: 1,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                cursor: 'pointer'
                              }}
                              onClick={() => window.open(photo.signedUrl, '_blank')}
                            />
                          </Box>
                        </Box>
                        
                        {/* Detection Results Image */}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight="bold" gutterBottom>
                            With Object Detection ({detailedResults.total_detections} objects found)
                          </Typography>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              justifyContent: 'center', 
                              p: 2, 
                              border: '2px solid #2196f3', 
                              borderRadius: 2,
                              backgroundColor: '#f3f9ff'
                            }}
                          >
                            <Box
                              component="img"
                              src={detailedResults.visualization_path ? aiService.getVisualizationImageUrl(detailedResults.visualization_path) : ''}
                              alt="Object Detection Visualization"
                              sx={{
                                width: '100%',
                                maxWidth: 400,
                                height: 'auto',
                                borderRadius: 1,
                                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                if (detailedResults.visualization_path) {
                                  const imageUrl = aiService.getVisualizationImageUrl(detailedResults.visualization_path);
                                  window.open(imageUrl, '_blank');
                                }
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                        💡 Click any image to view full size in new tab
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Visualization image not available
                    </Typography>
                  )}
                </Box>
                
                {/* Analysis Summary */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Analysis Summary
                  </Typography>
                  <Typography variant="body2">
                    • Model: {detailedResults.model_name}
                  </Typography>
                  <Typography variant="body2">
                    • Confidence Threshold: {detailedResults.confidence_threshold}
                  </Typography>
                  <Typography variant="body2">
                    • Processing Time: {detailedResults.processing_time.toFixed(2)}s
                  </Typography>
                  <Typography variant="body2">
                    • Image Dimensions: {detailedResults.image_dimensions.width} × {detailedResults.image_dimensions.height}
                  </Typography>
                </Box>
                
                {/* Detected Objects List */}
                <Typography variant="subtitle2" gutterBottom>
                  Detected Objects ({detailedResults.total_detections})
                </Typography>
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {detailedResults.detections.map((detection: Detection, index: number) => (
                    <Card key={index} variant="outlined" sx={{ mb: 1, p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            {detection.class_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Confidence: {(detection.confidence * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Chip 
                          label={`${(detection.confidence * 100).toFixed(1)}%`}
                          color={detection.confidence > 0.8 ? 'success' : detection.confidence > 0.5 ? 'warning' : 'default'}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Position: ({detection.bbox.x1}, {detection.bbox.y1}) - ({detection.bbox.x2}, {detection.bbox.y2})
                      </Typography>
                      <Typography variant="body2">
                        Size: {detection.bbox.width} × {detection.bbox.height} pixels
                      </Typography>
                      <Typography variant="body2">
                        Center: ({detection.center_point[0].toFixed(0)}, {detection.center_point[1].toFixed(0)})
                      </Typography>
                    </Card>
                  ))}
                </Box>
              </>
            )}
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
