import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { compareAnalyses } from '../services/analysisService';

export const DatasetComparisonPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get analysis IDs from URL params
  const analysisIds = searchParams.get('ids')?.split(',') || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['analysisComparison', analysisIds],
    queryFn: () => compareAnalyses(analysisIds),
    enabled: analysisIds.length > 0
  });

  const comparisonData = data?.data?.comparison || [];

  const formatNumber = (value: any, decimals: number = 2): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return 'N/A';
  };

  const formatPixels = (pixels: number): string => {
    if (pixels >= 1000000) {
      return `${(pixels / 1000000).toFixed(2)}M`;
    } else if (pixels >= 1000) {
      return `${(pixels / 1000).toFixed(1)}K`;
    }
    return pixels.toString();
  };

  if (analysisIds.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          No analysis IDs provided. Please select analyses to compare from the analyses list.
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/analysis')}>
            Back to Analyses
          </Button>
        </Box>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading analysis comparison...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load analysis comparison: {error instanceof Error ? error.message : 'Unknown error'}
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
            Dataset Analysis Comparison
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comparing {comparisonData.length} dataset analysis{comparisonData.length !== 1 ? 'es' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/analysis')}
          >
            Back to Analyses
          </Button>
        </Box>
      </Box>

      {/* Analysis Overview Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
        {comparisonData.map((comparison) => (
          <Box key={comparison.analysis._id} sx={{ minHeight: 200 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {comparison.analysis.dataset}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(comparison.analysis.timestamp).toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Frames</Typography>
                  <Typography variant="h6">{comparison.metrics.totalFrames.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Pixels</Typography>
                  <Typography variant="body2">{formatPixels(comparison.metrics.totalPixels)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Classes</Typography>
                  <Typography variant="body2">{comparison.metrics.totalClasses}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Dimensions</Typography>
                  <Typography variant="body2">
                    {comparison.metrics.imageDimensions.width}x{comparison.metrics.imageDimensions.height}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">
                Created: {new Date(comparison.analysis.createdAt).toLocaleString()}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Box>

      {/* Detailed Comparison Table */}
      {comparisonData.length > 0 && (
        <Paper sx={{ mb: 4 }}>
          <Box sx={{ p: 3, pb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Detailed Comparison
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Metric</strong></TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      <strong>{comp.analysis.dataset}</strong>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Total Frames</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {comp.metrics.totalFrames.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Total Pixels</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {formatPixels(comp.metrics.totalPixels)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Total Classes</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {comp.metrics.totalClasses}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Image Width</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {comp.metrics.imageDimensions.width}px
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Image Height</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {comp.metrics.imageDimensions.height}px
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Pixels per Frame</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {formatNumber(comp.metrics.pixelsPerFrame)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Classes per Frame</TableCell>
                  {comparisonData.map((comp) => (
                    <TableCell key={comp.analysis._id} align="center">
                      {formatNumber(comp.metrics.classesPerFrame)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Class Analysis Comparison */}
      {comparisonData.length > 0 && comparisonData.some(comp => comp.classAnalysis.length > 0) && (
        <Paper>
          <Box sx={{ p: 3, pb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Class Analysis Comparison
            </Typography>
          </Box>

          {/* Extract all unique class names from all analyses */}
          {(() => {
            const allClasses = new Set<number>();
            comparisonData.forEach(comp => {
              comp.classAnalysis.forEach(cls => {
                allClasses.add(cls.classId);
              });
            });

            const classIds = Array.from(allClasses).sort();

            if (classIds.length === 0) {
              return (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No class analysis data available
                  </Typography>
                </Box>
              );
            }

            return (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell rowSpan={2} sx={{ borderBottom: '2px solid rgba(224, 224, 224, 1)' }}>
                        <strong>Class</strong>
                      </TableCell>
                      {comparisonData.map((comp) => (
                        <TableCell
                          key={comp.analysis._id}
                          colSpan={4}
                          align="center"
                          sx={{ borderBottom: '2px solid rgba(224, 224, 224, 1)' }}
                        >
                          <strong>{comp.analysis.dataset}</strong>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      {comparisonData.map((comp) => (
                        <React.Fragment key={comp.analysis._id}>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Pixels</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>% Total</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Frames</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>% Coverage</TableCell>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {classIds.map((classId) => {
                      // Get class name from first analysis that has this class
                      const className = comparisonData
                        .flatMap(comp => comp.classAnalysis)
                        .find(cls => cls.classId === classId)?.name || `Class ${classId}`;

                      return (
                        <TableRow key={classId}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {className.charAt(0).toUpperCase() + className.slice(1)}
                          </TableCell>
                          {comparisonData.map((comp) => {
                            const classMetrics = comp.classAnalysis.find(cls => cls.classId === classId);

                            return (
                              <React.Fragment key={comp.analysis._id}>
                                <TableCell align="center">
                                  {classMetrics ? (
                                    <Typography variant="body2">
                                      {classMetrics.totalPixels.toLocaleString()}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      N/A
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  {classMetrics ? (
                                    <Typography variant="body2">
                                      {formatNumber(classMetrics.pixelPercentage)}%
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      N/A
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  {classMetrics ? (
                                    <Typography variant="body2">
                                      {classMetrics.framesWithClass.toLocaleString()}
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      N/A
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  {classMetrics ? (
                                    <Typography variant="body2">
                                      {formatNumber(classMetrics.frameCoveragePercentage)}%
                                    </Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      N/A
                                    </Typography>
                                  )}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}
        </Paper>
      )}
    </Container>
  );
};

export default DatasetComparisonPage;
