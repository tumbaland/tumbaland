import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { trainingService } from '../services/trainingService';
import { configService } from '../services/configService';
import { getAllAnalyses, type DatasetAnalysis } from '../services/analysisService';
import { Training, Config } from '../types';
import TrainingsTable from '../components/TrainingsTable';
import TrainingFilters from '../components/TrainingFilters';
import TrainingFormDialog from '../components/TrainingFormDialog';

const TrainingsPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [trainingName, setTrainingName] = useState('');
  const [trainingDescription, setTrainingDescription] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Training['status']>('pending');
  const [datasets, setDatasets] = useState<DatasetAnalysis[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTrainingId, setDeleteTrainingId] = useState<string | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load configs and datasets when modal opens
  React.useEffect(() => {
    if (createModalOpen) {
      const loadData = async () => {
        try {
          setLoadingConfigs(true);
          setLoadingDatasets(true);
          
          const [configsRes, analysisRes] = await Promise.all([
            configService.getAllConfigs(),
            getAllAnalyses(100, 0)
          ]);
          
          setConfigs(configsRes.data.configs || []);
          setDatasets(analysisRes.data || []);
        } catch (err) {
          console.error('Failed to load configs/datasets:', err);
          setConfigs([]);
          setDatasets([]);
        } finally {
          setLoadingConfigs(false);
          setLoadingDatasets(false);
        }
      };
      loadData();
    }
  }, [createModalOpen]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trainings', page + 1, rowsPerPage, debouncedSearch, statusFilter],
    queryFn: () => trainingService.getTrainings({
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter as Training['status'] : undefined,
      sortBy: 'updatedAt',
      order: 'desc'
    })
  });

  const trainings = data?.data?.trainings || [];
  const total = data?.data?.pagination?.total || 0;

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateTraining = async () => {
    if (!trainingName.trim()) {
      setCreateError('Training name is required');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      setCreateSuccess(null);

      if (editingTrainingId) {
        // Update existing training
        await trainingService.updateTraining(editingTrainingId, {
          name: trainingName.trim(),
          description: trainingDescription.trim() || undefined,
          datasetId: selectedDatasetId || undefined,
          configId: selectedConfigId || undefined,
          status: selectedStatus,
        });
        setCreateSuccess('Training updated successfully!');
      } else {
        // Create new training
        await trainingService.createTraining({
          name: trainingName.trim(),
          description: trainingDescription.trim() || undefined,
          datasetId: selectedDatasetId || undefined,
          configId: selectedConfigId || undefined,
          status: selectedStatus
        });
        setCreateSuccess(`Training "${trainingName}" created successfully!`);
      }

      setTrainingName('');
      setTrainingDescription('');
      setSelectedDatasetId('');
      setSelectedConfigId('');
      setTimeout(() => {
        setCreateModalOpen(false);
        setEditingTrainingId(null);
        refetch();
      }, 1000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to save training');
    } finally {
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    if (!creating) {
      setCreateModalOpen(false);
      setTrainingName('');
      setTrainingDescription('');
      setSelectedDatasetId('');
      setSelectedConfigId('');
      setSelectedStatus('pending');
      setCreateError(null);
      setCreateSuccess(null);
      setEditingTrainingId(null);
    }
  };

  const handleEditTraining = async (training: Training) => {
    try {
      setLoadingConfigs(true);
      setLoadingDatasets(true);

      // Load configs and datasets
      const [configsRes, analysisRes] = await Promise.all([
        configService.getAllConfigs(),
        getAllAnalyses(100, 0)
      ]);

      setConfigs(configsRes.data.configs || []);
      setDatasets(analysisRes.data || []);

      // Populate form with training data
      setEditingTrainingId(training._id);
      setTrainingName(training.name);
      setTrainingDescription(training.description || '');
      setSelectedDatasetId(training.datasetId || '');
      setSelectedConfigId(training.configId || '');
      setSelectedStatus(training.status);
      setCreateModalOpen(true);
    } catch (err) {
      console.error('Failed to load data for editing:', err);
    } finally {
      setLoadingConfigs(false);
      setLoadingDatasets(false);
    }
  };

  const handleDeleteClick = (trainingId: string) => {
    setDeleteTrainingId(trainingId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTrainingId) return;

    try {
      setCreating(true);
      await trainingService.deleteTraining(deleteTrainingId);
      setCreateSuccess('Training deleted successfully!');
      setDeleteDialogOpen(false);
      setDeleteTrainingId(null);
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to delete training');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Training Runs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Training
          </Button>
          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TrainingFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : 'Failed to load training runs'}
        </Alert>
      )}

      <TrainingsTable
        trainings={trainings}
        isLoading={isLoading}
        page={page}
        rowsPerPage={rowsPerPage}
        total={total}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        onEdit={handleEditTraining}
        onDelete={handleDeleteClick}
        hasFilters={statusFilter !== 'all'}
        searchTerm={searchTerm}
      />

      {/* Create/Edit Training Modal */}
      <TrainingFormDialog
        open={createModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateTraining}
        isEditing={!!editingTrainingId}
        isCreating={creating}
        isLoadingData={loadingConfigs || loadingDatasets}
        trainingName={trainingName}
        onNameChange={setTrainingName}
        trainingDescription={trainingDescription}
        onDescriptionChange={setTrainingDescription}
        selectedConfigId={selectedConfigId}
        onConfigChange={setSelectedConfigId}
        selectedDatasetId={selectedDatasetId}
        onDatasetChange={setSelectedDatasetId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        configs={configs}
        datasets={datasets}
        error={createError}
        success={createSuccess}
        loadingConfigs={loadingConfigs}
        loadingDatasets={loadingDatasets}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Training</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this training? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={creating}
          >
            {creating ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TrainingsPage;
