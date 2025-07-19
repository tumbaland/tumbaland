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
import { SegmentationResult, HealthStatus, aiService } from '../services/aiService';

interface SegmentationViewProps {
  photo: any;
  detailedResults: SegmentationResult | undefined;
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

const SegmentationView: React.FC<SegmentationViewProps> = ({
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
            <Typography variant="h6">Segmentation Service Status</Typography>
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
                icon={healthStatus.segmentation ? <CheckCircleIcon /> : <WarningIcon />}
                label={`Segmentation: ${healthStatus.segmentation ? 'Online' : 'Offline'}`}
                color={healthStatus.segmentation ? 'success' : 'error'}
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
            
            <Typography variant="body2" color="text.secondary">
              Analyzed: {formatDate(photo.aiAnalysis.segmentation.analyzedAt)}
            </Typography>
            <Typography variant="body2">
              Generated {photo.aiAnalysis.segmentation.totalMasks} masks 
              ({photo.aiAnalysis.segmentation.segmentationType} segmentation, 
              Processing time: {photo.aiAnalysis.segmentation.processingTime.toFixed(2)}s)
            </Typography>
            {loadingDetails === 'segmentation' && (
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
      {(detailedResults || (photo.aiAnalysis?.segmentation && loadingDetails === 'segmentation')) && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Segmentation Details
              </Typography>
              {detailedResults && (
                <IconButton size="small" onClick={onClearDetails}>
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
            
            {loadingDetails === 'segmentation' && !detailedResults && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
                <CircularProgress size={24} />
                <Typography>Loading detailed results...</Typography>
              </Box>
            )}

            {detailedResults && (
              <>
                {/* Segmentation Visualizations */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Segmentation Visualizations
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {detailedResults.result_paths.colored_masks && (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Colored Masks
                        </Typography>
                        <Box
                          component="img"
                          src={aiService.getSegmentationImageUrl(detailedResults.result_paths.colored_masks)}
                          alt="Colored Masks"
                          sx={{
                            width: 250,
                            height: 'auto',
                            borderRadius: 1,
                            border: '1px solid #e0e0e0',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => {
                            const imageUrl = aiService.getSegmentationImageUrl(detailedResults.result_paths.colored_masks);
                            window.open(imageUrl, '_blank');
                          }}
                        />
                      </Box>
                    )}
                    {detailedResults.result_paths.segmented && (
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          Segmented Image
                        </Typography>
                        <Box
                          component="img"
                          src={aiService.getSegmentationImageUrl(detailedResults.result_paths.segmented)}
                          alt="Segmented Image"
                          sx={{
                            width: 250,
                            height: 'auto',
                            borderRadius: 1,
                            border: '1px solid #e0e0e0',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8
                            }
                          }}
                          onClick={() => {
                            const imageUrl = aiService.getSegmentationImageUrl(detailedResults.result_paths.segmented);
                            window.open(imageUrl, '_blank');
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
                
                {/* Analysis Summary */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Analysis Summary
                  </Typography>
                  <Typography variant="body2">
                    • Segmentation Type: {detailedResults.segmentation_type}
                  </Typography>
                  <Typography variant="body2">
                    • Multimask Output: {detailedResults.multimask_output ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    • Processing Time: {detailedResults.processing_time.toFixed(2)}s
                  </Typography>
                  <Typography variant="body2">
                    • Image Dimensions: {detailedResults.image_dimensions.width} × {detailedResults.image_dimensions.height}
                  </Typography>
                </Box>
                
                {/* Individual Masks */}
                <Typography variant="subtitle2" gutterBottom>
                  Individual Masks ({detailedResults.total_masks})
                </Typography>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {detailedResults.masks.map((mask, index) => (
                    <Card key={index} variant="outlined" sx={{ mb: 1, p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="bold">
                            Mask {index + 1}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Area: {mask.area.toLocaleString()} pixels
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Chip 
                            label={`IoU: ${mask.predicted_iou.toFixed(2)}`}
                            color={mask.predicted_iou > 0.8 ? 'success' : mask.predicted_iou > 0.5 ? 'warning' : 'default'}
                            size="small"
                            sx={{ mb: 0.5 }}
                          />
                          <br />
                          <Chip 
                            label={`Stability: ${mask.stability_score.toFixed(2)}`}
                            color={mask.stability_score > 0.8 ? 'success' : mask.stability_score > 0.5 ? 'warning' : 'default'}
                            size="small"
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Bounding Box: ({mask.bbox[0]}, {mask.bbox[1]}) - {mask.bbox[2]} × {mask.bbox[3]}
                      </Typography>
                      {mask.mask_file_path && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Mask Visualization:
                          </Typography>
                          <Box
                            component="img"
                            src={aiService.getSegmentationImageUrl(mask.mask_file_path)}
                            alt={`Mask ${index + 1}`}
                            sx={{
                              width: '100%',
                              maxWidth: 200,
                              height: 'auto',
                              borderRadius: 1,
                              border: '1px solid #e0e0e0',
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8
                              }
                            }}
                            onClick={() => {
                              const maskUrl = aiService.getSegmentationImageUrl(mask.mask_file_path);
                              window.open(maskUrl, '_blank');
                            }}
                          />
                        </Box>
                      )}
                    </Card>
                  ))}
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Analysis Message */}
      {!photo.aiAnalysis?.segmentation && !detailedResults && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
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
