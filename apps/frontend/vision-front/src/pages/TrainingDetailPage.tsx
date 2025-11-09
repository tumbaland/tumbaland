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
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { trainingService } from '../services/trainingService';
import { epochService } from '../services/epochService';
import { configService } from '../services/configService';
import { testResultService } from '../services/testResultService';
import { getAllAnalyses, type DatasetAnalysis } from '../services/analysisService';
import { Epoch, TestResult, Config, Training } from '../types';
import TrainingOverviewTab from '../components/TrainingOverviewTab';
import TrainingEpochsTab from '../components/TrainingEpochsTab';
import TrainingTestResultsTab from '../components/TrainingTestResultsTab';
import TrainingConfigTab from '../components/TrainingConfigTab';
import TrainingFormDialog from '../components/TrainingFormDialog';

const TrainingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const testResultFileInputRef = useRef<HTMLInputElement>(null);

  const [detailTab, setDetailTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<Epoch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Epoch | null>(null);
  const [trainingDeleteOpen, setTrainingDeleteOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editConfigId, setEditConfigId] = useState('');
  const [editDatasetId, setEditDatasetId] = useState('');
  const [editStatus, setEditStatus] = useState<Training['status']>('pending');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [editConfigs, setEditConfigs] = useState<Config[]>([]);
  const [editDatasets, setEditDatasets] = useState<DatasetAnalysis[]>([]);
  const [editLoadingConfigs, setEditLoadingConfigs] = useState(false);
  const [editLoadingDatasets, setEditLoadingDatasets] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [uploadResultsOpen, setUploadResultsOpen] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    successful: Array<{ name: string; operation: string }>;
    failed: Array<{ name: string; error: string }>;
  }>({ successful: [], failed: [] });
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testResultsLoading, setTestResultsLoading] = useState(false);
  const [selectedTestEpoch, setSelectedTestEpoch] = useState<number | null>(null);
  const [availableTestEpochs, setAvailableTestEpochs] = useState<number[]>([]);
  const [latexModalOpen, setLatexModalOpen] = useState(false);
  const [latexCode, setLatexCode] = useState('');

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

  // Load test results data
  React.useEffect(() => {
    const fetchTestResultsData = async () => {
      if (!training) return;

      try {
        setTestResultsLoading(true);
        // Get available epochs that have test results globally
        const epochsResponse = await testResultService.getTestResultEpochs();
        const allTestResultEpochs = epochsResponse.data.epochs || [];

        // Filter to only include epochs that belong to this training
        const trainingEpochNumbers = epochs.map(e => e.epoch);
        const availableEpochs = allTestResultEpochs.filter(epoch =>
          trainingEpochNumbers.includes(epoch)
        ).sort((a, b) => a - b);

        setAvailableTestEpochs(availableEpochs);

        // Auto-select epoch logic:
        // 1. If no epoch is selected and there are available epochs, select the first one
        // 2. If an epoch is selected but it's not in the available epochs, select the first available one
        // 3. Otherwise, keep the current selection
        let epochToSelect = selectedTestEpoch;

        if (!selectedTestEpoch && availableEpochs.length > 0) {
          // No epoch selected, select the first one
          epochToSelect = availableEpochs[0];
        } else if (selectedTestEpoch && !availableEpochs.includes(selectedTestEpoch)) {
          // Currently selected epoch is no longer available, select the first available one
          epochToSelect = availableEpochs.length > 0 ? availableEpochs[0] : null;
        }

        if (epochToSelect) {
          setSelectedTestEpoch(epochToSelect);
          await loadTestResultsForEpoch(epochToSelect);
        } else {
          setTestResults([]);
        }
      } catch (err) {
        console.error('Failed to fetch test results data:', err);
        setTestResults([]);
      } finally {
        setTestResultsLoading(false);
      }
    };

    fetchTestResultsData();
  }, [training, epochs]);

  const loadTestResultsForEpoch = async (epoch: number) => {
    if (!training) return;

    try {
      setTestResultsLoading(true);
      // Find the epoch UUID for this training and epoch number
      const trainingEpoch = epochs.find(e => e.epoch === epoch);
      if (trainingEpoch) {
        const response = await testResultService.getTestResultsByEpochUuid(trainingEpoch.epoch_uuid);
        setTestResults(response.data.testResults || []);
      } else {
        setTestResults([]);
      }
    } catch (err) {
      console.error('Failed to load test results for epoch:', err);
      setTestResults([]);
    } finally {
      setTestResultsLoading(false);
    }
  };

  // Handle epoch selection change
  const handleTestEpochChange = async (epoch: number) => {
    setSelectedTestEpoch(epoch);
    await loadTestResultsForEpoch(epoch);
  };

  // File upload handler
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

  // Wrapper for epoch file upload
  const handleEpochFileUpload = async (files: FileList) => {
    // Create a mock event object
    const mockEvent = {
      target: { files }
    } as React.ChangeEvent<HTMLInputElement>;
    await handleFileChange(mockEvent);
  };

  // Wrapper for test result file upload
  const handleTestResultFileUpload = async (files: FileList) => {
    // Create a mock event object
    const mockEvent = {
      target: { files }
    } as React.ChangeEvent<HTMLInputElement>;
    await handleTestResultFileChange(mockEvent);
  };

  // Test result file upload handler
  const handleTestResultFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          const testResultData = JSON.parse(content);

          // Upload test result
          await testResultService.uploadTestResult(testResultData);

          successfulFiles.push({ name: file.name, operation: 'uploaded' });
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
        setUploadSuccess(`${successCount} test result file(s) uploaded successfully`);
        // Refresh test results data
        const epochsResponse = await testResultService.getTestResultEpochs();
        setAvailableTestEpochs(epochsResponse.data.epochs || []);
        if (selectedTestEpoch) {
          await loadTestResultsForEpoch(selectedTestEpoch);
        }
      }

      if (errors.length > 0) {
        setUploadError(`Failed to upload ${failureCount} file(s)`);
      }

      if (testResultFileInputRef.current) {
        testResultFileInputRef.current.value = '';
      }

      setTimeout(() => {
        setUploadSuccess(null);
        setUploadError(null);
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload test results';
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

  // Training edit handlers
  const handleEditTraining = async () => {
    if (!training) return;

    try {
      setEditLoadingConfigs(true);
      setEditLoadingDatasets(true);

      // Load configs and datasets
      const [configsRes, analysisRes] = await Promise.all([
        configService.getAllConfigs(),
        getAllAnalyses(100, 0)
      ]);

      setEditConfigs(configsRes.data.configs || []);
      setEditDatasets(analysisRes.data || []);

      // Load available tags
      const allTrainings = await trainingService.getTrainings({
        page: 1,
        limit: 1000
      });
      const tags = new Set<string>();
      allTrainings.data.trainings.forEach((t: Training) => {
        if (t.tags) {
          t.tags.forEach(tag => tags.add(tag));
        }
      });
      setAvailableTags(Array.from(tags).sort());

      // Populate form with training data
      setEditName(training.name);
      setEditDescription(training.description || '');
      setEditConfigId(training.configId || '');
      setEditDatasetId(training.datasetId || '');
      setEditStatus(training.status);
      setEditTags(training.tags || []);
      setEditDialogOpen(true);
    } catch (err) {
      console.error('Failed to load data for editing:', err);
    } finally {
      setEditLoadingConfigs(false);
      setEditLoadingDatasets(false);
    }
  };

  const handleEditConfirm = async () => {
    if (!training || !editName.trim()) return;

    try {
      setUploading(true);
      await trainingService.updateTraining(training._id, {
        name: editName.trim(),
        description: editDescription.trim(),
        configId: editConfigId || undefined,
        datasetId: editDatasetId || undefined,
        status: editStatus,
        tags: editTags,
      });
      setUploadSuccess('Training updated successfully');
      refetch();
      setEditDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update training';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setEditName('');
    setEditDescription('');
    setEditConfigId('');
    setEditDatasetId('');
    setEditStatus('pending');
    setEditTags([]);
  };

  // Training delete handlers
  const handleDeleteTraining = () => {
    setTrainingDeleteOpen(true);
  };

  const handleConfirmDeleteTraining = async () => {
    if (!training) return;

    try {
      setUploading(true);
      await trainingService.deleteTraining(training._id);
      setUploadSuccess('Training deleted successfully');
      navigate('/trainings');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete training';
      setUploadError(message);
    } finally {
      setUploading(false);
      setTrainingDeleteOpen(false);
    }
  };

  const handleCancelDeleteTraining = () => {
    setTrainingDeleteOpen(false);
  };

  // Generate LaTeX code from test results
  const generateLatexCode = (testResult: TestResult): string => {
    const conditions = [
      { key: 'day_fair', label: 'Dry day' },
      { key: 'day_rain', label: 'Rainy day' },
      { key: 'night_fair', label: 'Dry night' },
      { key: 'night_rain', label: 'Rainy night' }
    ];

    let latex = `\\begin{table*}[ht]
\\centering
\\caption{Performance comparison during various weather conditions.}
\\begin{tabular}{|c|c|c|c|c|c|c|c|c|c|}
\\hline & \\multicolumn{3}{|c|}{IoU} & \\multicolumn{3}{|c|}{Precision} & \\multicolumn{3}{|c|}{Recall} \\\\
\\hline & Cyclist & Pedestrian & Sign & Cyclist & Pedestrian & Sign & Cyclist & Pedestrian & Sign \\\\
\\hline
`;

    conditions.forEach((condition) => {
      const conditionData = (testResult.test_results as any)[condition.key];
      if (!conditionData) return;

      const cyclist = conditionData.cyclist;
      const pedestrian = conditionData.pedestrian;
      const sign = conditionData.sign;

      latex += `\\multicolumn{10}{|c|}{${condition.label}} \\\\
\\hline
Camera & ${cyclist ? cyclist.iou.toFixed(4) : '-'} & ${pedestrian ? pedestrian.iou.toFixed(4) : '-'} & ${sign ? sign.iou.toFixed(4) : '-'} & ${cyclist ? cyclist.precision.toFixed(4) : '-'} & ${pedestrian ? pedestrian.precision.toFixed(4) : '-'} & ${sign ? sign.precision.toFixed(4) : '-'} & ${cyclist ? cyclist.recall.toFixed(4) : '-'} & ${pedestrian ? pedestrian.recall.toFixed(4) : '-'} & ${sign ? sign.recall.toFixed(4) : '-'} \\\\
\\hline
`;
    });

    latex += `\\end{tabular}
\\label{table:performance}
\\end{table*}`;

    return latex;
  };

  // Handle LaTeX export
  const handleLatexExport = (testResult: TestResult) => {
    const latex = generateLatexCode(testResult);
    setLatexCode(latex);
    setLatexModalOpen(true);
  };

  // Utility functions
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
        <Box display="flex" gap={1}>
          <IconButton onClick={handleEditTraining} disabled={isLoading}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={handleDeleteTraining} disabled={isLoading}>
            <DeleteIcon />
          </IconButton>
          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={detailTab} onChange={(_e: React.SyntheticEvent, v: number) => setDetailTab(v)}>
          <Tab label="Overview" />
          <Tab label="Epochs" />
          <Tab label="Test Results" />
          <Tab label="Config" />
        </Tabs>
      </Paper>

      {/* Overview Tab */}
      {detailTab === 0 && (
        <TrainingOverviewTab
          training={training}
          epochs={epochs}
          trainingId={id!}
        />
      )}

      {/* Epochs Tab */}
      {detailTab === 1 && (
        <TrainingEpochsTab
          epochs={epochs}
          uploading={uploading}
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
          selectedEpoch={selectedEpoch}
          detailsOpen={detailsOpen}
          deleteOpen={deleteOpen}
          deleteTarget={deleteTarget}
          uploadResultsOpen={uploadResultsOpen}
          uploadResults={uploadResults}
          onFileUpload={handleEpochFileUpload}
          onViewDetails={handleViewDetails}
          onDeleteClick={handleDeleteClick}
          onConfirmDelete={handleConfirmDelete}
          onSetDetailsOpen={setDetailsOpen}
          onSetDeleteOpen={setDeleteOpen}
          onSetUploadResultsOpen={setUploadResultsOpen}
        />
      )}

      {/* Test Results Tab */}
      {detailTab === 2 && (
        <TrainingTestResultsTab
          testResults={testResults}
          testResultsLoading={testResultsLoading}
          availableTestEpochs={availableTestEpochs}
          selectedTestEpoch={selectedTestEpoch}
          uploading={uploading}
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
          uploadResultsOpen={uploadResultsOpen}
          uploadResults={uploadResults}
          latexModalOpen={latexModalOpen}
          latexCode={latexCode}
          onTestResultFileUpload={handleTestResultFileUpload}
          onTestEpochChange={handleTestEpochChange}
          onLatexExport={handleLatexExport}
          onSetUploadResultsOpen={setUploadResultsOpen}
          onSetLatexModalOpen={setLatexModalOpen}
        />
      )}

      {/* Config Tab */}
      {detailTab === 3 && (
        <TrainingConfigTab
          config={config}
          configLoading={configLoading}
          training={training}
        />
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

      {/* LaTeX Export Dialog */}
      <Dialog open={latexModalOpen} onClose={() => setLatexModalOpen(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setLatexModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Training Dialog */}
      <TrainingFormDialog
        open={editDialogOpen}
        onClose={handleEditCancel}
        onSubmit={handleEditConfirm}
        isEditing={true}
        isCreating={uploading}
        isLoadingData={editLoadingConfigs || editLoadingDatasets}
        trainingName={editName}
        onNameChange={setEditName}
        trainingDescription={editDescription}
        onDescriptionChange={setEditDescription}
        selectedConfigId={editConfigId}
        onConfigChange={setEditConfigId}
        selectedDatasetId={editDatasetId}
        onDatasetChange={setEditDatasetId}
        selectedStatus={editStatus}
        onStatusChange={setEditStatus}
        trainingTags={editTags}
        onTagsChange={setEditTags}
        availableTags={availableTags}
        configs={editConfigs}
        datasets={editDatasets}
        error={uploadError}
        success={uploadSuccess}
        loadingConfigs={editLoadingConfigs}
        loadingDatasets={editLoadingDatasets}
      />

      {/* Delete Training Confirmation Dialog */}
      <Dialog open={trainingDeleteOpen} onClose={handleCancelDeleteTraining}>
        <DialogTitle>Delete Training</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this training? This action cannot be undone and will also delete all associated epochs and test results.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDeleteTraining}>Cancel</Button>
          <Button
            onClick={handleConfirmDeleteTraining}
            color="error"
            variant="contained"
            disabled={uploading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TrainingDetailPage;
