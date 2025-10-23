import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
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
  Alert,
  CircularProgress,
  Typography,
  IconButton,
  Chip,
  Stack,
  Checkbox
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CloudUpload as CloudUploadIcon,
  DeleteOutline as DeleteOutlineIcon
} from '@mui/icons-material';
import { configService } from '../services/configService';
import { Config } from '../types';

const ConfigsPage = () => {
  // State
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedConfigIds, setSelectedConfigIds] = useState<Set<string>>(new Set());
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);

  // Dialog states
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all configs on mount
  useEffect(() => {
    loadConfigs();
  }, []);

  // Load configs
  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await configService.getAllConfigs();
      setConfigs(response.data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs');
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection and upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      setError('No files selected');
      return;
    }

    const fileArray = Array.from(files);
    const errors: string[] = [];
    let successCount = 0;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      for (const file of fileArray) {
        try {
          const fileContent = await file.text();
          const configData = JSON.parse(fileContent);

          // Extract summary from config (usually the "Summary" field)
          const summary = configData.Summary || configData.summary || 'Config';
          const configName = file.name.replace('.json', '');

          // Upload config
          await configService.uploadConfig({
            config_data: configData,
            Summary: summary,
            config_name: configName
          });

          successCount++;
        } catch (fileErr) {
          errors.push(`${file.name}: ${fileErr instanceof Error ? fileErr.message : 'Upload failed'}`);
        }
      }

      if (successCount > 0) {
        setSuccess(`${successCount} config(s) uploaded successfully!`);
        await loadConfigs();
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload configs');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle view details
  const handleViewDetails = (config: Config) => {
    setSelectedConfig(config);
    setDetailsDialogOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (configId: string) => {
    setDeleteConfigId(configId);
    setDeleteDialogOpen(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteConfigId) return;

    try {
      setLoading(true);
      await configService.deleteConfig(deleteConfigId);
      setSuccess('Config deleted successfully!');
      setDeleteDialogOpen(false);
      setDeleteConfigId(null);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete config');
    } finally {
      setLoading(false);
    }
  };

  // Handle checkbox change
  const handleSelectConfig = (configId: string) => {
    const newSelected = new Set(selectedConfigIds);
    if (newSelected.has(configId)) {
      newSelected.delete(configId);
    } else {
      newSelected.add(configId);
    }
    setSelectedConfigIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedConfigIds.size === configs.length) {
      setSelectedConfigIds(new Set());
    } else {
      setSelectedConfigIds(new Set(configs.map(c => c._id)));
    }
  };

  // Handle delete selected
  const handleDeleteSelected = async () => {
    try {
      setLoading(true);
      const configsToDelete = Array.from(selectedConfigIds);
      
      for (const configId of configsToDelete) {
        await configService.deleteConfig(configId);
      }
      
      setSuccess(`${configsToDelete.length} config(s) deleted successfully!`);
      setDeleteMultipleDialogOpen(false);
      setSelectedConfigIds(new Set());
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configs');
    } finally {
      setLoading(false);
    }
  };

  // Format config data for display
  const formatConfigData = (data: any, depth: number = 0): React.ReactNode => {
    if (depth > 3) return null; // Limit nesting depth for display
    
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }

    if (Array.isArray(data)) {
      return `[${data.join(', ')}]`;
    }

    return (
      <Box sx={{ pl: 2 }}>
        {Object.entries(data).map(([key, value]) => (
          <Box key={key} sx={{ mb: 1 }}>
            <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
              {key}:
            </Typography>{' '}
            <Typography variant="body2" component="span">
              {typeof value === 'object' && value !== null
                ? formatConfigData(value, depth + 1)
                : String(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Configs Library
      </Typography>

      <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
        Manage training configurations. Configs are independent and can be selected when creating trainings.
      </Typography>

      {/* File Upload */}
      <Box sx={{ mb: 3 }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Config Files'}
        </Button>
      </Box>

      {/* Messages */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Configs Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {selectedConfigIds.size > 0 && (
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedConfigIds.size} config(s) selected
              </Typography>
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
          <TableContainer component={Paper}>
            <Table>
              <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>
                    <Checkbox
                      indeterminate={
                        selectedConfigIds.size > 0 && selectedConfigIds.size < configs.length
                      }
                      checked={configs.length > 0 && selectedConfigIds.size === configs.length}
                      onChange={handleSelectAll}
                      disabled={configs.length === 0}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Config Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Summary</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>UUID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                      No configs uploaded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  configs.map((config) => (
                    <TableRow
                      key={config._id}
                      hover
                      selected={selectedConfigIds.has(config._id)}
                      sx={{
                        backgroundColor: selectedConfigIds.has(config._id)
                          ? 'rgba(25, 118, 210, 0.08)'
                          : 'inherit'
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedConfigIds.has(config._id)}
                          onChange={() => handleSelectConfig(config._id)}
                        />
                      </TableCell>
                      <TableCell>{config.config_name || 'Unnamed'}</TableCell>
                      <TableCell>
                        <Chip label={config.summary} variant="outlined" size="small" />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {config.config_uuid.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {new Date(config.createdAt).toLocaleDateString()} {new Date(config.createdAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewDetails(config)}
                            title="View Details"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(config._id)}
                            title="Delete"
                            disabled={loading}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Config Details</DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {selectedConfig && (
            <Box sx={{ py: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Config UUID:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', mb: 2 }}
                >
                  {selectedConfig.config_uuid}
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Summary:
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {selectedConfig.summary}
                </Typography>

                {selectedConfig.config_name && (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Config Name:
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {selectedConfig.config_name}
                    </Typography>
                  </>
                )}

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Config Data:
                </Typography>
              </Box>
              <Paper sx={{ p: 2, backgroundColor: '#f9f9f9', overflow: 'auto' }}>
                {formatConfigData(selectedConfig.config_data)}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Config</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this config? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Multiple Confirmation Dialog */}
      <Dialog
        open={deleteMultipleDialogOpen}
        onClose={() => setDeleteMultipleDialogOpen(false)}
      >
        <DialogTitle>Delete Selected Configs</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedConfigIds.size} config(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteMultipleDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSelected}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConfigsPage;
