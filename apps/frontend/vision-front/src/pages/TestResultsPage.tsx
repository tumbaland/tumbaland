import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Typography,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Info as InfoIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { testResultService } from '../services/testResultService';
import { epochService } from '../services/epochService';
import { TestResult, TestResultData } from '../types';

export const TestResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [availableEpochs, setAvailableEpochs] = useState<number[]>([]);
  const [selectedEpoch, setSelectedEpoch] = useState<string | number>('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestResult | null>(null);

  useEffect(() => {
    loadAvailableEpochs();
  }, []);

  useEffect(() => {
    if (availableEpochs.length > 0) {
      loadTestResults();
    }
  }, [selectedEpoch, availableEpochs]);

  const loadAvailableEpochs = async () => {
    try {
      const response = await testResultService.getTestResultEpochs();
      setAvailableEpochs(response.data.epochs || []);
      if (response.data.epochs && response.data.epochs.length > 0 && selectedEpoch === '') {
        setSelectedEpoch(response.data.epochs[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load available epochs');
    }
  };

  const loadTestResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedEpoch !== '' ? { epoch: Number(selectedEpoch) } : undefined;
      const response = await testResultService.getTestResults(params);
      setTestResults(response.data.testResults || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test results');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file is JSON
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Read file content
      const content = await file.text();
      const data = JSON.parse(content);

      // Upload to API
      await testResultService.uploadTestResult(data);

      setSuccess('Test result uploaded successfully!');
      loadTestResults();
      loadAvailableEpochs();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload test result');
    } finally {
      setUploading(false);
    }
  };

  const handleViewDetails = async (testResult: TestResult) => {
    try {
      // Get the epoch to find the training ID
      const epochResponse = await epochService.getEpochByUuid(testResult.epoch_uuid);
      const trainingId = epochResponse.data.trainingId;
      
      // Navigate to the training details page with test results tab active
      navigate(`/trainings/${trainingId}?tab=test-results`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate to training details');
    }
  };

  const handleDeleteClick = (testResult: TestResult) => {
    setDeleteTarget(testResult);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setLoading(true);
      await testResultService.deleteTestResult(deleteTarget._id);
      setSuccess('Test result deleted successfully');
      loadTestResults();
      loadAvailableEpochs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test result');
    } finally {
      setLoading(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (value: number, decimals: number = 4): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '-';
  };

  const getAverageMetric = (conditionData: TestResultData[string], metric: keyof TestResultData[string][string]): number => {
    const classes = Object.values(conditionData);
    const sum = classes.reduce((acc, classData) => acc + classData[metric], 0);
    return sum / classes.length;
  };

  const getOverallAverage = (testResults: TestResultData, metric: keyof TestResultData[string][string]): number => {
    const conditions = Object.values(testResults);
    const sum = conditions.reduce((acc, condition) => acc + getAverageMetric(condition, metric), 0);
    return sum / conditions.length;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Test Results
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Upload Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Upload Test Result JSON File
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Button
              variant="contained"
              startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
              onClick={handleFileClick}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Select JSON File'}
            </Button>
            <Typography variant="body2" color="textSecondary">
              Upload test result files to add them to the database
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Epoch Filter */}
      {availableEpochs.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Filter by Epoch
            </Typography>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Select Epoch</InputLabel>
              <Select
                value={selectedEpoch}
                onChange={(e) => setSelectedEpoch(e.target.value === '' ? '' : Number(e.target.value))}
                label="Select Epoch"
                disabled={loading}
              >
                <MenuItem value="">
                  <em>All Epochs</em>
                </MenuItem>
                {availableEpochs.map((epoch) => (
                  <MenuItem key={epoch} value={epoch}>
                    Epoch {epoch}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      )}

      {/* Test Results Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Test Results {selectedEpoch !== '' && `for Epoch ${selectedEpoch}`}
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : testResults.length === 0 ? (
            <Typography color="textSecondary">
              {selectedEpoch !== '' ? `No test results found for epoch ${selectedEpoch}` : 'No test results found'}
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>
                      <strong>Epoch</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Test UUID</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Avg IoU</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Avg Recall</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Avg F1</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Timestamp</strong>
                    </TableCell>
                    <TableCell align="center">
                      <strong>Actions</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testResults.map((testResult) => {
                    const avgIou = getOverallAverage(testResult.test_results, 'iou');
                    const avgRecall = getOverallAverage(testResult.test_results, 'recall');
                    const avgF1 = getOverallAverage(testResult.test_results, 'f1_score');

                    return (
                      <TableRow key={testResult._id} hover>
                        <TableCell>
                          <Chip label={`Epoch ${testResult.epoch}`} color="primary" size="small" />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {testResult.test_uuid.substring(0, 8)}...
                        </TableCell>
                        <TableCell align="right">{formatNumber(avgIou)}</TableCell>
                        <TableCell align="right">{formatNumber(avgRecall)}</TableCell>
                        <TableCell align="right">{formatNumber(avgF1)}</TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                          {formatDate(testResult.timestamp)}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={() => handleViewDetails(testResult)}>
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => handleDeleteClick(testResult)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Test Result</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this test result? This action cannot be undone.
          </Typography>
          {deleteTarget && (
            <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
              Test UUID: {deleteTarget.test_uuid}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TestResultsPage;