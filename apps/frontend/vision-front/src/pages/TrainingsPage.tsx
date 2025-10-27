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
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Compare as CompareIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import { configService } from '../services/configService';
import { getAllAnalyses, type DatasetAnalysis } from '../services/analysisService';
import { Training, Config } from '../types';
import TrainingsTable from '../components/TrainingsTable';
import TrainingFilters from '../components/TrainingFilters';
import TrainingFormDialog from '../components/TrainingFormDialog';

const TrainingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt' | 'status' | 'totalTime' | 'cpuCost' | 'gpuCost' | 'totalCost'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [trainingName, setTrainingName] = useState('');
  const [trainingDescription, setTrainingDescription] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Training['status']>('pending');
  const [trainingTags, setTrainingTags] = useState<string[]>([]);
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
  const [selectedTrainingIds, setSelectedTrainingIds] = useState<Set<string>>(new Set());
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

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
    queryKey: ['trainings', page + 1, rowsPerPage, debouncedSearch, statusFilter, sortBy, sortOrder, selectedTags],
    queryFn: () => trainingService.getTrainings({
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter as Training['status'] : undefined,
      sortBy,
      order: sortOrder,
      tags: selectedTags.length > 0 ? selectedTags : undefined
    })
  });

  const { data: statsData } = useQuery({
    queryKey: ['training-stats', statusFilter],
    queryFn: () => trainingService.getTrainingStats({
      status: statusFilter !== 'all' ? statusFilter as Training['status'] : undefined
    })
  });

  // Load available tags
  const loadTags = React.useCallback(async () => {
    try {
      const allTrainings = await trainingService.getTrainings({
        page: 1,
        limit: 1000 // Get a large number to collect all tags
      });
      const tags = new Set<string>();
      allTrainings.data.trainings.forEach((training: Training) => {
        if (training.tags) {
          training.tags.forEach(tag => tags.add(tag));
        }
      });
      setAvailableTags(Array.from(tags).sort());
    } catch (err) {
      console.error('Failed to load tags:', err);
      setAvailableTags([]);
    }
  }, []);

  React.useEffect(() => {
    loadTags();
  }, [loadTags]);

  const trainings = data?.data?.trainings || [];
  const total = data?.data?.pagination?.total || 0;
  const stats = statsData?.data;

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (column: 'name' | 'createdAt' | 'updatedAt' | 'status' | 'totalTime' | 'cpuCost' | 'gpuCost' | 'totalCost') => {
    if (sortBy === column) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(0); // Reset to first page when sorting changes
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
          tags: trainingTags,
        });
        setCreateSuccess('Training updated successfully!');
      } else {
        // Create new training
        await trainingService.createTraining({
          name: trainingName.trim(),
          description: trainingDescription.trim() || undefined,
          datasetId: selectedDatasetId || undefined,
          configId: selectedConfigId || undefined,
          status: selectedStatus,
          tags: trainingTags,
        });
        setCreateSuccess(`Training "${trainingName}" created successfully!`);
      }

      // Close modal immediately and refresh
      setCreateModalOpen(false);
      setEditingTrainingId(null);
      setTrainingName('');
      setTrainingDescription('');
      setSelectedDatasetId('');
      setSelectedConfigId('');
      refetch();
      // Refresh available tags to include any new tags that were added
      loadTags();
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
      setTrainingTags([]);
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
      setTrainingTags(training.tags || []);
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
        // Refresh available tags in case some tags are no longer used
        loadTags();
      }, 500);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to delete training');
    } finally {
      setCreating(false);
    }
  };

  // Handle checkbox change
  const handleSelectTraining = (trainingId: string) => {
    const newSelected = new Set(selectedTrainingIds);
    if (newSelected.has(trainingId)) {
      newSelected.delete(trainingId);
    } else {
      newSelected.add(trainingId);
    }
    setSelectedTrainingIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedTrainingIds.size === trainings.length) {
      setSelectedTrainingIds(new Set());
    } else {
      setSelectedTrainingIds(new Set(trainings.map(t => t._id)));
    }
  };

  // Handle compare selected
  const handleCompareSelected = () => {
    const selectedIds = Array.from(selectedTrainingIds);
    if (selectedIds.length > 1) {
      navigate(`/trainings/compare?ids=${selectedIds.join(',')}`);
    }
  };

  // Handle delete selected
  const handleDeleteSelected = async () => {
    try {
      setCreating(true);
      const trainingsToDelete = Array.from(selectedTrainingIds);
      
      for (const trainingId of trainingsToDelete) {
        await trainingService.deleteTraining(trainingId);
      }
      
      setCreateSuccess(`${trainingsToDelete.length} training(s) deleted successfully!`);
      setDeleteMultipleDialogOpen(false);
      setSelectedTrainingIds(new Set());
      setTimeout(() => {
        refetch();
        // Refresh available tags in case some tags are no longer used
        loadTags();
      }, 500);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to delete trainings');
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
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        availableTags={availableTags}
      />

      {/* Training Statistics */}
      {stats && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Training Statistics
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Trainings
              </Typography>
              <Typography variant="h6">
                {stats.totalTrainings}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Time
              </Typography>
              <Typography variant="h6">
                {Math.round(stats.totalTime / 3600 * 10) / 10}h
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                CPU Cost
              </Typography>
              <Typography variant="h6">
                €{stats.totalCpuCost.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                GPU Cost
              </Typography>
              <Typography variant="h6">
                €{stats.totalGpuCost.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Cost
              </Typography>
              <Typography variant="h6">
                €{stats.totalCost.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : 'Failed to load training runs'}
        </Alert>
      )}

      {/* Bulk Delete UI */}
      {selectedTrainingIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedTrainingIds.size} training(s) selected
          </Typography>
          {selectedTrainingIds.size > 1 && (
            <Button
              variant="contained"
              startIcon={<CompareIcon />}
              onClick={handleCompareSelected}
              color="primary"
            >
              Compare
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setDeleteMultipleDialogOpen(true)}
          >
            Delete Selected
          </Button>
        </Box>
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
        selectedTrainingIds={selectedTrainingIds}
        onSelectTraining={handleSelectTraining}
        onSelectAll={handleSelectAll}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
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
        trainingTags={trainingTags}
        onTagsChange={setTrainingTags}
        availableTags={availableTags}
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

      {/* Delete Multiple Confirmation Dialog */}
      <Dialog
        open={deleteMultipleDialogOpen}
        onClose={() => setDeleteMultipleDialogOpen(false)}
      >
        <DialogTitle>Delete Selected Trainings</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedTrainingIds.size} training(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteMultipleDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSelected}
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
