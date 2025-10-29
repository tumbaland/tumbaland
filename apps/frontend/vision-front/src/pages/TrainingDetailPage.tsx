import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
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
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts';
import { trainingService } from '../services/trainingService';
import { epochService } from '../services/epochService';
import { configService } from '../services/configService';
import { Epoch } from '../types';
import ClassIoUChart from '../components/ClassIoUChart';
import TrainingTimeMetrics from '../components/TrainingTimeMetrics';
import TrainingOverviewCard from '../components/TrainingOverviewCard';
import ClassPrecisionChart from '../components/ClassPrecisionChart';
import ClassRecallChart from '../components/ClassRecallChart';
import ClassF1Chart from '../components/ClassF1Chart';
import ChartComments from '../components/ChartComments';

const TrainingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detailTab, setDetailTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<Epoch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Epoch | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [uploadResultsOpen, setUploadResultsOpen] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    successful: Array<{ name: string; operation: string }>;
    failed: Array<{ name: string; error: string }>;
  }>({ successful: [], failed: [] });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['training', id],
    queryFn: () => trainingService.getTrainingWithEpochs(id!),
    enabled: !!id
  });

  const training = data?.data?.training;
  const epochs = data?.data?.epochs || [];

  // Fetch config when training data is available
  React.useEffect(() => {
    const fetchConfig = async () => {
      if (training?.configId) {
        try {
          setConfigLoading(true);
          const response = await configService.getConfigById(training.configId);
          setConfig(response.data);
        } catch (err) {
          console.error('Failed to fetch config:', err);
          setConfig(null);
        } finally {
          setConfigLoading(false);
        }
      }
    };

    fetchConfig();
  }, [training?.configId]);

  // File upload handler
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];
      const successfulFiles: Array<{ name: string; operation: string }> = [];
      const failedFiles: Array<{ name: string; error: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.name.endsWith('.json')) {
          const error = 'Invalid file type (must be .json)';
          errors.push(`${file.name}: ${error}`);
          failedFiles.push({ name: file.name, error });
          failureCount++;
          continue;
        }

        try {
          const content = await file.text();
          const epochData = JSON.parse(content);

          // Check if epoch has an ID (_id or epoch_uuid)
          const epochId = epochData._id || epochData.epoch_uuid;
          let operation = 'created';

          if (epochId) {
            // Try to update existing epoch
            try {
              await epochService.updateEpoch(epochId, {
                ...epochData,
                trainingId: id
              });
              operation = 'updated';
            } catch (updateErr) {
              // If update fails, try to create new epoch
              await epochService.uploadEpoch(
                { ...epochData, trainingId: id },
                id
              );
              operation = 'created';
            }
          } else {
            // No ID provided, create new epoch
            await epochService.uploadEpoch(
              { ...epochData, trainingId: id },
              id
            );
            operation = 'created';
          }

          successfulFiles.push({ name: file.name, operation });
          successCount++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${file.name}: ${message}`);
          failedFiles.push({ name: file.name, error: message });
          failureCount++;
        }
      }

      // Store results for modal
      setUploadResults({
        successful: successfulFiles,
        failed: failedFiles
      });

      if (successCount > 0) {
        setUploadSuccess(`${successCount} epoch file(s) processed successfully`);
      }

      if (errors.length > 0) {
        setUploadError(`Failed to process ${failureCount} file(s)`);
      }

      refetch();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setTimeout(() => {
        setUploadSuccess(null);
        setUploadError(null);
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload epochs';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  // Epoch details handlers
  const handleViewDetails = (epoch: Epoch) => {
    setSelectedEpoch(epoch);
    setDetailsOpen(true);
  };

  const handleDeleteClick = (epoch: Epoch) => {
    setDeleteTarget(epoch);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setUploading(true);
      await epochService.deleteEpoch(deleteTarget._id);
      setUploadSuccess('Epoch deleted successfully');
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete epoch';
      setUploadError(message);
    } finally {
      setUploading(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  // Utility functions
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

  const formatNumber = (value: any, decimals: number = 4): string => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value.toFixed(decimals);
    }
    return '-';
  };

  // Loading and error states
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !training) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load training details'}
        </Alert>
      </Container>
    );
  }

  // Calculate chart data
  const lastEpoch = epochs[epochs.length - 1];
  const classMetrics = lastEpoch?.results?.metrics?.per_class || {};
  const epochNumbers = epochs.map(e => e.epoch);
  const trainLoss = epochs.map(e => e.results?.train?.loss ?? null);
  const valLoss = epochs.map(e => e.results?.val?.loss ?? null);
  const trainMeanIoU = epochs.map(e => e.results?.train?.mean_iou ?? null);
  const valMeanIoU = epochs.map(e => e.results?.val?.mean_iou ?? null);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/trainings')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Training Details
          </Typography>
        </Box>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={detailTab} onChange={(_e: React.SyntheticEvent, v: number) => setDetailTab(v)}>
          <Tab label="Overview" />
          <Tab label="Epochs" />
          <Tab label="Config" />
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      {detailTab === 0 && (
        <Box display="flex" flexDirection="column" gap={3}>
          {/* Training Overview Card */}
          <TrainingOverviewCard training={training} epochs={epochs} />

          {/* Loss Chart */}
          {epochs.length > 0 && trainLoss.some(v => v !== undefined) && (
            <Paper sx={{ p: 3, position: 'relative' }}>
              <Typography variant="h6" gutterBottom>Loss Over Epochs</Typography>
              <Box sx={{ width: '100%', height: 350 }}>
                <LineChart
                  xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                  series={[
                    { data: trainLoss, label: 'Train Loss', color: '#424242', showMark: false },
                    { data: valLoss, label: 'Val Loss', color: '#757575', showMark: false }
                  ]}
                  margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
                />
              </Box>
              <ChartComments trainingId={id!} section="loss_chart" />
            </Paper>
          )}

          {/* Mean IoU Chart */}
          {epochs.length > 0 && trainMeanIoU.some(v => v !== undefined) && (
            <Paper sx={{ p: 3, position: 'relative' }}>
              <Typography variant="h6" gutterBottom>Mean IoU Over Epochs</Typography>
              <Box sx={{ width: '100%', height: 350 }}>
                <LineChart
                  xAxis={[{ data: epochNumbers, label: 'Epoch' }]}
                  series={[
                    { data: trainMeanIoU, label: 'Train mIoU', color: '#212121', showMark: false },
                    { data: valMeanIoU, label: 'Val mIoU', color: '#616161', showMark: false }
                  ]}
                  margin={{ top: 10, bottom: 40, left: 60, right: 10 }}
                />
              </Box>
              <ChartComments trainingId={id!} section="iou_chart" />
            </Paper>
          )}

          {/* Training Time Metrics */}
          <TrainingTimeMetrics epochs={epochs} trainingId={id} />

          {/* Class IoU Chart */}
          <ClassIoUChart epochs={epochs} trainingId={id} />

          {/* Class Precision Chart */}
          <ClassPrecisionChart epochs={epochs} trainingId={id} />

          {/* Class Recall Chart */}
          <ClassRecallChart epochs={epochs} trainingId={id} />

          {/* Class F1 Chart */}
          <ClassF1Chart epochs={epochs} trainingId={id} />

          {/* Per-Class Metrics Table */}
          {Object.keys(classMetrics).length > 0 && (
            <Paper>
              <Box p={3}>
                <Typography variant="h6" gutterBottom>Per-Class Metrics (Latest Epoch)</Typography>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Class</strong></TableCell>
                      <TableCell align="right"><strong>IoU</strong></TableCell>
                      <TableCell align="right"><strong>Precision</strong></TableCell>
                      <TableCell align="right"><strong>Recall</strong></TableCell>
                      <TableCell align="right"><strong>F1 Score</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(classMetrics).map(([className, metrics]: [string, any]) => (
                      <TableRow key={className}>
                        <TableCell>{className}</TableCell>
                        <TableCell align="right">{metrics.iou?.toFixed(4) || '-'}</TableCell>
                        <TableCell align="right">{metrics.precision?.toFixed(4) || '-'}</TableCell>
                        <TableCell align="right">{metrics.recall?.toFixed(4) || '-'}</TableCell>
                        <TableCell align="right">{metrics.f1?.toFixed(4) || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Epochs Tab */}
      {detailTab === 1 && (
        <Paper>
          <Box p={3}>
            <Typography variant="h6" gutterBottom>Epochs Management</Typography>
            <Divider sx={{ mb: 3 }} />

            {/* Upload Section */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Upload Epoch JSON Files
              </Typography>
              {uploadError && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 2 }}
                  action={
                    <IconButton
                      size="small"
                      color="inherit"
                      onClick={() => setUploadResultsOpen(true)}
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
                      onClick={() => setUploadResultsOpen(true)}
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
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  onClick={handleFileClick}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Select JSON Files'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Upload one or more epoch results JSON files
                </Typography>
              </Box>
            </Box>

            {/* Epochs Table */}
            {epochs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No epochs uploaded yet. Upload an epoch JSON file to get started.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Epoch</strong></TableCell>
                      <TableCell align="right"><strong>Train Loss</strong></TableCell>
                      <TableCell align="right"><strong>Val Loss</strong></TableCell>
                      <TableCell align="right"><strong>Train mIoU</strong></TableCell>
                      <TableCell align="right"><strong>Val mIoU</strong></TableCell>
                      <TableCell align="right"><strong>Learning Rate</strong></TableCell>
                      <TableCell align="right"><strong>Time (s)</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {epochs.map((epoch) => (
                      <TableRow key={epoch._id} hover>
                        <TableCell>{epoch.epoch}</TableCell>
                        <TableCell align="right">{formatNumber(epoch.results?.train?.loss)}</TableCell>
                        <TableCell align="right">{formatNumber(epoch.results?.val?.loss)}</TableCell>
                        <TableCell align="right">{formatNumber(epoch.results?.train?.mean_iou)}</TableCell>
                        <TableCell align="right">{formatNumber(epoch.results?.val?.mean_iou)}</TableCell>
                        <TableCell align="right">{epoch.learning_rate?.toExponential(2) || '-'}</TableCell>
                        <TableCell align="right">{epoch.epoch_time?.toFixed(2) || '-'}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={() => handleViewDetails(epoch)}>
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => handleDeleteClick(epoch)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      )}

      {/* Config Tab */}
      {detailTab === 2 && (
        <Paper>
          <Box p={3}>
            <Typography variant="h6" gutterBottom>Training Configuration</Typography>
            <Divider sx={{ mb: 3 }} />

            {configLoading && (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            )}

            {!configLoading && !training?.configId && (
              <Alert severity="info">
                No configuration associated with this training.
              </Alert>
            )}

            {!configLoading && training?.configId && !config && (
              <Alert severity="error">
                Failed to load configuration. The associated config may have been deleted.
              </Alert>
            )}

            {!configLoading && config && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Config Header */}
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {config.config_name || 'Unnamed Configuration'}
                      </Typography>
                      {config.summary && (
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {config.summary}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* Config UUID */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Configuration ID
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      p: 1.5,
                      bgcolor: 'grey.100',
                      borderRadius: 1
                    }}
                  >
                    {config.config_uuid || config._id || '-'}
                  </Typography>
                </Box>

                {/* Config Data */}
                {config.config_data && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
                      Configuration Details
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'grey.300',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}
                    >
                      <Box
                        component="pre"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word'
                        }}
                      >
                        {typeof config.config_data === 'string'
                          ? config.config_data
                          : JSON.stringify(config.config_data, null, 2)}
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Config Metadata */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Metadata
                  </Typography>
                  <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Created</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {config.createdAt ? formatDate(config.createdAt) : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Last Updated</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {config.updatedAt ? formatDate(config.updatedAt) : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Epoch Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Epoch Details - Epoch {selectedEpoch?.epoch}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedEpoch && (
            <Box sx={{ display: 'grid', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Overview</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pl: 2 }}>
                  <Typography variant="body2">
                    <strong>Epoch UUID:</strong> {selectedEpoch.epoch_uuid}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Learning Rate:</strong> {selectedEpoch.learning_rate?.toExponential(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Epoch Time:</strong> {selectedEpoch.epoch_time?.toFixed(2)}s
                  </Typography>
                  <Typography variant="body2">
                    <strong>Timestamp:</strong> {new Date(selectedEpoch.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              {selectedEpoch.results?.train && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Training Results</Typography>
                  <Box sx={{ pl: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Typography variant="body2">
                      <strong>Loss:</strong> {formatNumber(selectedEpoch.results.train.loss)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>mIoU:</strong> {formatNumber(selectedEpoch.results.train.mean_iou)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {selectedEpoch.results?.val && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Validation Results</Typography>
                  <Box sx={{ pl: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Typography variant="body2">
                      <strong>Loss:</strong> {formatNumber(selectedEpoch.results.val.loss)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>mIoU:</strong> {formatNumber(selectedEpoch.results.val.mean_iou)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Epoch</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete Epoch {deleteTarget?.epoch}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={uploading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Results Modal */}
      <Dialog open={uploadResultsOpen} onClose={() => setUploadResultsOpen(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setUploadResultsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TrainingDetailPage;
