import React, { useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { TestResult } from '../types';

interface TrainingTestResultsTabProps {
  testResults: TestResult[];
  testResultsLoading: boolean;
  availableTestEpochs: number[];
  selectedTestEpoch: number | null;
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  uploadResultsOpen: boolean;
  uploadResults: {
    successful: Array<{ name: string; operation: string }>;
    failed: Array<{ name: string; error: string }>;
  };
  latexModalOpen: boolean;
  latexCode: string;
  onTestResultFileUpload: (files: FileList) => Promise<void>;
  onTestEpochChange: (epoch: number) => void;
  onLatexExport: (testResult: TestResult) => void;
  onSetUploadResultsOpen: (open: boolean) => void;
  onSetLatexModalOpen: (open: boolean) => void;
}

const TrainingTestResultsTab: React.FC<TrainingTestResultsTabProps> = ({
  testResults,
  testResultsLoading,
  availableTestEpochs,
  selectedTestEpoch,
  uploading,
  uploadError,
  uploadSuccess,
  uploadResultsOpen,
  uploadResults,
  latexModalOpen,
  latexCode,
  onTestResultFileUpload,
  onTestEpochChange,
  onLatexExport,
  onSetUploadResultsOpen,
  onSetLatexModalOpen
}) => {
  const testResultFileInputRef = useRef<HTMLInputElement>(null);

  const handleTestResultFileClick = () => {
    testResultFileInputRef.current?.click();
  };

  const handleTestResultFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await onTestResultFileUpload(files);
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const formatNumber = (value: any, decimals: number = 4): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '-';
  };

  return (
    <Paper>
      <Box p={3}>
        <Typography variant="h6" gutterBottom>Test Results</Typography>
        <Divider sx={{ mb: 3 }} />

        {/* Upload Section */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Upload Test Result JSON Files
          </Typography>
          {uploadError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => onSetUploadResultsOpen(true)}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              }
            >
              {uploadError}
            </Alert>
          )}
          {uploadSuccess && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
              action={
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => onSetUploadResultsOpen(true)}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              }
            >
              {uploadSuccess}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              ref={testResultFileInputRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleTestResultFileChange}
              style={{ display: 'none' }}
            />
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleTestResultFileClick}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Select JSON Files'}
            </Button>
            <Typography variant="caption" color="text.secondary">
              Upload one or more test result JSON files
            </Typography>
          </Box>
        </Box>

        {/* Epoch Selection */}
        {availableTestEpochs.length > 0 && testResults.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Epoch</InputLabel>
              <Select
                key={`epoch-select-${selectedTestEpoch}`}
                value={selectedTestEpoch?.toString() ?? ''}
                onChange={(e) => onTestEpochChange(Number(e.target.value))}
                label="Select Epoch"
                disabled={testResultsLoading}
                displayEmpty
              >
                {availableTestEpochs.map((epoch) => (
                  <MenuItem key={epoch} value={epoch.toString()}>
                    Epoch {epoch}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Test Results Table */}
        {testResultsLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : testResults.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No test results found for the selected epoch. Please upload test results JSON files.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {testResults.map((testResult, index) => (
              <Box key={testResult._id}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      Test Result {index + 1} - {formatDate(testResult.timestamp)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Test UUID: {testResult.test_uuid}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<CodeIcon />}
                    onClick={() => onLatexExport(testResult)}
                    size="small"
                  >
                    Export LaTeX
                  </Button>
                </Box>

                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                        <TableCell rowSpan={2} sx={{ borderRight: '2px solid #ddd' }}><strong>Condition</strong></TableCell>
                        <TableCell colSpan={3} align="center" sx={{ borderRight: '2px solid #ddd' }}><strong>IoU</strong></TableCell>
                        <TableCell colSpan={3} align="center" sx={{ borderRight: '2px solid #ddd' }}><strong>Precision</strong></TableCell>
                        <TableCell colSpan={3} align="center"><strong>Recall</strong></TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell align="center"><strong>Cyclist</strong></TableCell>
                        <TableCell align="center"><strong>Pedestrian</strong></TableCell>
                        <TableCell align="center" sx={{ borderRight: '2px solid #ddd' }}><strong>Sign</strong></TableCell>
                        <TableCell align="center"><strong>Cyclist</strong></TableCell>
                        <TableCell align="center"><strong>Pedestrian</strong></TableCell>
                        <TableCell align="center" sx={{ borderRight: '2px solid #ddd' }}><strong>Sign</strong></TableCell>
                        <TableCell align="center"><strong>Cyclist</strong></TableCell>
                        <TableCell align="center"><strong>Pedestrian</strong></TableCell>
                        <TableCell align="center"><strong>Sign</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        { key: 'day_fair', label: 'Dry Day' },
                        { key: 'day_rain', label: 'Rainy Day' },
                        { key: 'night_fair', label: 'Dry Night' },
                        { key: 'night_rain', label: 'Rainy Night' }
                      ].map((condition) => {
                        const conditionData = (testResult.test_results as any)[condition.key];
                        if (!conditionData) return null;

                        const cyclist = conditionData.cyclist;
                        const pedestrian = conditionData.pedestrian;
                        const sign = conditionData.sign;

                        return (
                          <TableRow key={condition.key}>
                            <TableCell sx={{ fontWeight: 'bold', borderRight: '2px solid #ddd' }}>
                              {condition.label}
                            </TableCell>
                            <TableCell align="center">{cyclist ? formatNumber(cyclist.iou) : '-'}</TableCell>
                            <TableCell align="center">{pedestrian ? formatNumber(pedestrian.iou) : '-'}</TableCell>
                            <TableCell align="center" sx={{ borderRight: '2px solid #ddd' }}>{sign ? formatNumber(sign.iou) : '-'}</TableCell>
                            <TableCell align="center">{cyclist ? formatNumber(cyclist.precision) : '-'}</TableCell>
                            <TableCell align="center">{pedestrian ? formatNumber(pedestrian.precision) : '-'}</TableCell>
                            <TableCell align="center" sx={{ borderRight: '2px solid #ddd' }}>{sign ? formatNumber(sign.precision) : '-'}</TableCell>
                            <TableCell align="center">{cyclist ? formatNumber(cyclist.recall) : '-'}</TableCell>
                            <TableCell align="center">{pedestrian ? formatNumber(pedestrian.recall) : '-'}</TableCell>
                            <TableCell align="center">{sign ? formatNumber(sign.recall) : '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Upload Results Modal */}
      <Dialog open={uploadResultsOpen} onClose={() => onSetUploadResultsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Results</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Successful Files */}
            {uploadResults.successful.length > 0 && (
              <Box>
                <Typography variant="h6" color="success.main" gutterBottom>
                  Successfully Processed ({uploadResults.successful.length})
                </Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'success.light', borderRadius: 1, p: 1 }}>
                  {uploadResults.successful.map((file, index) => (
                    <Typography key={index} variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{file.name}</span>
                      <span style={{ color: 'green', fontWeight: 'bold' }}>({file.operation})</span>
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {/* Failed Files */}
            {uploadResults.failed.length > 0 && (
              <Box>
                <Typography variant="h6" color="error.main" gutterBottom>
                  Failed to Process ({uploadResults.failed.length})
                </Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'error.light', borderRadius: 1, p: 1 }}>
                  {uploadResults.failed.map((file, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="error.main" sx={{ ml: 2 }}>
                        {file.error}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onSetUploadResultsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* LaTeX Export Dialog */}
      <Dialog open={latexModalOpen} onClose={() => onSetLatexModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Export Results as LaTeX</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            You can copy the LaTeX code below and paste it into your LaTeX document to include the results table.
          </Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.300',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            {latexCode}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onSetLatexModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TrainingTestResultsTab;