import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { getAllAnalyses, DatasetAnalysis } from '../services/analysisService';

export const DatasetComparisonPage: React.FC = () => {
  const [analyses, setAnalyses] = useState<DatasetAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataset1Id, setDataset1Id] = useState<string>('');
  const [dataset2Id, setDataset2Id] = useState<string>('');
  const [comparison, setComparison] = useState<{
    dataset1: DatasetAnalysis;
    dataset2: DatasetAnalysis;
  } | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllAnalyses(100);
      setAnalyses(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!dataset1Id || !dataset2Id) {
      setError('Please select both datasets');
      return;
    }

    if (dataset1Id === dataset2Id) {
      setError('Please select two different datasets');
      return;
    }

    try {
      setComparing(true);
      setError(null);

      const d1 = analyses.find((a) => a._id === dataset1Id);
      const d2 = analyses.find((a) => a._id === dataset2Id);

      if (!d1 || !d2) {
        setError('One or both datasets not found');
        return;
      }

      setComparison({ dataset1: d1, dataset2: d2 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare datasets');
    } finally {
      setComparing(false);
    }
  };

  const handleReset = () => {
    setComparison(null);
    setDataset1Id('');
    setDataset2Id('');
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number): string => {
    return num.toFixed(2) + '%';
  };

  const getDifference = (val1: number, val2: number, isPercentage = false): string => {
    const diff = val1 - val2;
    const sign = diff > 0 ? '+' : '';
    if (isPercentage) {
      return `${sign}${diff.toFixed(2)}%`;
    }
    return `${sign}${formatNumber(diff)}`;
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Dataset Comparison
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Selection Panel */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Dataset 1</InputLabel>
                <Select
                  value={dataset1Id}
                  onChange={(e) => setDataset1Id(e.target.value)}
                  label="Dataset 1"
                  disabled={comparing}
                >
                  <MenuItem value="">
                    <em>Select dataset</em>
                  </MenuItem>
                  {analyses.map((analysis) => (
                    <MenuItem key={analysis._id} value={analysis._id}>
                      {analysis.dataset} - {new Date(analysis.timestamp).toLocaleDateString()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Dataset 2</InputLabel>
                <Select
                  value={dataset2Id}
                  onChange={(e) => setDataset2Id(e.target.value)}
                  label="Dataset 2"
                  disabled={comparing}
                >
                  <MenuItem value="">
                    <em>Select dataset</em>
                  </MenuItem>
                  {analyses.map((analysis) => (
                    <MenuItem key={analysis._id} value={analysis._id}>
                      {analysis.dataset} - {new Date(analysis.timestamp).toLocaleDateString()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCompare}
                  disabled={comparing || !dataset1Id || !dataset2Id}
                >
                  {comparing ? <CircularProgress size={24} /> : 'Compare'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {comparison && (
          <Box>
            {/* Overview Metrics */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Overview Comparison
                </Typography>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell>
                          <strong>Metric</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{comparison.dataset1.dataset}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{comparison.dataset2.dataset}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>Difference</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Frames</TableCell>
                        <TableCell align="right">
                          {formatNumber(comparison.dataset1.total_frames)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(comparison.dataset2.total_frames)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              comparison.dataset1.total_frames > comparison.dataset2.total_frames
                                ? '#4caf50'
                                : '#f44336'
                          }}
                        >
                          {getDifference(
                            comparison.dataset1.total_frames,
                            comparison.dataset2.total_frames
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Total Pixels</TableCell>
                        <TableCell align="right">
                          {(comparison.dataset1.total_pixels / 1000000).toFixed(2)}M
                        </TableCell>
                        <TableCell align="right">
                          {(comparison.dataset2.total_pixels / 1000000).toFixed(2)}M
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              comparison.dataset1.total_pixels > comparison.dataset2.total_pixels
                                ? '#4caf50'
                                : '#f44336'
                          }}
                        >
                          {(getDifference(
                            comparison.dataset1.total_pixels,
                            comparison.dataset2.total_pixels
                          ) as string).includes('M')
                            ? getDifference(
                                comparison.dataset1.total_pixels / 1000000,
                                comparison.dataset2.total_pixels / 1000000
                              ) + 'M'
                            : getDifference(
                                comparison.dataset1.total_pixels,
                                comparison.dataset2.total_pixels
                              )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Total Classes</TableCell>
                        <TableCell align="right">{comparison.dataset1.total_classes}</TableCell>
                        <TableCell align="right">{comparison.dataset2.total_classes}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              comparison.dataset1.total_classes > comparison.dataset2.total_classes
                                ? '#4caf50'
                                : '#f44336'
                          }}
                        >
                          {getDifference(
                            comparison.dataset1.total_classes,
                            comparison.dataset2.total_classes
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Image Width</TableCell>
                        <TableCell align="right">
                          {comparison.dataset1.image_dimensions.width}px
                        </TableCell>
                        <TableCell align="right">
                          {comparison.dataset2.image_dimensions.width}px
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              comparison.dataset1.image_dimensions.width >
                              comparison.dataset2.image_dimensions.width
                                ? '#4caf50'
                                : '#f44336'
                          }}
                        >
                          {getDifference(
                            comparison.dataset1.image_dimensions.width,
                            comparison.dataset2.image_dimensions.width
                          )}
                          px
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Image Height</TableCell>
                        <TableCell align="right">
                          {comparison.dataset1.image_dimensions.height}px
                        </TableCell>
                        <TableCell align="right">
                          {comparison.dataset2.image_dimensions.height}px
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              comparison.dataset1.image_dimensions.height >
                              comparison.dataset2.image_dimensions.height
                                ? '#4caf50'
                                : '#f44336'
                          }}
                        >
                          {getDifference(
                            comparison.dataset1.image_dimensions.height,
                            comparison.dataset2.image_dimensions.height
                          )}
                          px
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Class Analysis Comparison */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Class Analysis Comparison
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  {/* Dataset 1 Classes */}
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                      {comparison.dataset1.dataset} Classes
                    </Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableCell>
                              <strong>Class</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>Pixels</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>%</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>Frames</strong>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparison.dataset1.class_analysis.map((cls) => (
                            <TableRow key={cls.class_id}>
                              <TableCell>{cls.name}</TableCell>
                              <TableCell align="right">{formatNumber(cls.total_pixels)}</TableCell>
                              <TableCell align="right">{formatPercentage(cls.pixel_percentage)}</TableCell>
                              <TableCell align="right">{formatNumber(cls.frames_with_class)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Dataset 2 Classes */}
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                      {comparison.dataset2.dataset} Classes
                    </Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            <TableCell>
                              <strong>Class</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>Pixels</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>%</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>Frames</strong>
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparison.dataset2.class_analysis.map((cls) => (
                            <TableRow key={cls.class_id}>
                              <TableCell>{cls.name}</TableCell>
                              <TableCell align="right">{formatNumber(cls.total_pixels)}</TableCell>
                              <TableCell align="right">{formatPercentage(cls.pixel_percentage)}</TableCell>
                              <TableCell align="right">{formatNumber(cls.frames_with_class)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Reset Button */}
            <Button variant="outlined" onClick={handleReset} fullWidth>
              Clear Comparison
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DatasetComparisonPage;
