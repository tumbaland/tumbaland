import React, { useState, useEffect } from 'react';
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
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Compare as CompareIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { visualizationService } from '../services/visualizationService';
import { Visualization } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';

export const VisualizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Visualization | null>(null);
  const [selectedVisualizations, setSelectedVisualizations] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [types, setTypes] = useState<string[]>([]);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Visualization | null>(null);

  usePageTitle('Visualizations - Vision');

  useEffect(() => {
    loadVisualizations();
    loadTypes();
  }, [typeFilter]);

  const loadVisualizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get visualizations across all trainings
      const response = await visualizationService.getVisualizationsByTraining(
        '', // Empty training_uuid to get all
        {
          type: typeFilter !== 'all' ? typeFilter : undefined,
          limit: 1000
        }
      );
      
      const visualizationsData = response.data.visualizations || [];
      setVisualizations(visualizationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visualizations');
    } finally {
      setLoading(false);
    }
  };

  const loadTypes = async () => {
    try {
      const response = await visualizationService.getVisualizationTypes({});
      setTypes(response.data.types || []);
    } catch (err) {
      console.error('Failed to load visualization types:', err);
    }
  };

  const handleViewImage = (visualization: Visualization) => {
    setSelectedImage(visualization);
    setImageDialogOpen(true);
  };

  const handleDeleteClick = (visualization: Visualization) => {
    setDeleteTarget(visualization);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setLoading(true);
      await visualizationService.deleteVisualization(deleteTarget.visualization_uuid);
      setSuccess('Visualization deleted successfully');
      loadVisualizations();
      loadTypes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete visualization');
    } finally {
      setLoading(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSelectVisualization = (visualizationId: string, checked: boolean) => {
    const newSelected = new Set(selectedVisualizations);
    if (checked) {
      newSelected.add(visualizationId);
    } else {
      newSelected.delete(visualizationId);
    }
    setSelectedVisualizations(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVisualizations(new Set(visualizations.map(v => v.visualization_uuid)));
    } else {
      setSelectedVisualizations(new Set());
    }
  };

  const handleCompare = () => {
    if (selectedVisualizations.size < 2) {
      setError('Please select at least 2 visualizations to compare');
      return;
    }
    if (selectedVisualizations.size > 4) {
      setError('Maximum 4 visualizations can be compared at once');
      return;
    }
    const ids = Array.from(selectedVisualizations);
    navigate(`/visualizations/compare?ids=${ids.join(',')}`);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Visualizations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Visualizations Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Type Filter</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  label="Type Filter"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  {types.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<CompareIcon />}
                onClick={handleCompare}
                disabled={selectedVisualizations.size < 2}
              >
                Compare Selected ({selectedVisualizations.size})
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : visualizations.length === 0 ? (
            <Typography color="textSecondary">
              No visualizations found
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedVisualizations.size === visualizations.length && visualizations.length > 0}
                        indeterminate={selectedVisualizations.size > 0 && selectedVisualizations.size < visualizations.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell><strong>Filename</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Epoch</strong></TableCell>
                    <TableCell align="center"><strong>Uploaded</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visualizations.map((visualization) => (
                    <TableRow 
                      key={visualization.visualization_uuid}
                      hover 
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedVisualizations.has(visualization.visualization_uuid)}
                          onChange={(e) => handleSelectVisualization(visualization.visualization_uuid, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell onClick={() => handleViewImage(visualization)}>
                        {visualization.filename}
                      </TableCell>
                      <TableCell>
                        <Chip label={visualization.type} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {visualization.epoch !== undefined ? `Epoch ${visualization.epoch}` : '-'}
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                        {formatDate(visualization.uploadedAt)}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="View Image">
                          <IconButton size="small" onClick={() => handleViewImage(visualization)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteClick(visualization)}>
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
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Visualization</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this visualization? This action cannot be undone.
          </Typography>
          {deleteTarget && (
            <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
              File: {deleteTarget.filename}
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

      {/* Image View Dialog */}
      <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedImage?.filename}
          <IconButton
            onClick={() => setImageDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ✕
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box>
              <Box
                component="img"
                src={selectedImage.signedUrl || ''}
                alt={selectedImage.filename}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  bgcolor: 'grey.100'
                }}
              />
              <Box mt={2}>
                <Typography variant="body2">
                  <strong>Type:</strong> {selectedImage.type}
                </Typography>
                <Typography variant="body2">
                  <strong>Epoch:</strong> {selectedImage.epoch}
                </Typography>
                <Typography variant="body2">
                  <strong>Uploaded:</strong> {formatDate(selectedImage.uploadedAt)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VisualizationsPage;
