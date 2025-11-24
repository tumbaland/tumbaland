import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { Comparison } from '@/types';
import { comparisonService } from '@/services/comparisonService';

const ComparisonsPage: React.FC = () => {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comparisonToDelete, setComparisonToDelete] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'createdAt' | 'itemCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    loadComparisons();
  }, [sortBy, sortOrder]);

  const handleSort = (column: 'name' | 'type' | 'createdAt' | 'itemCount') => {
    if (sortBy === column) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column with default order
      setSortBy(column);
      setSortOrder(column === 'createdAt' ? 'desc' : 'asc'); // Default to desc for dates
    }
  };

  const loadComparisons = async () => {
    try {
      setLoading(true);
      const response = await comparisonService.getComparisons({
        page: 1,
        limit: 100,
        sortBy: sortBy === 'itemCount' ? 'createdAt' : sortBy, // API doesn't support itemCount sorting
        order: sortOrder,
      });
      let comparisonsData = response.data.comparisons || [];
      
      // Apply client-side sorting for itemCount
      if (sortBy === 'itemCount') {
        comparisonsData = [...comparisonsData].sort((a, b) => {
          const aCount = a.itemIds.length;
          const bCount = b.itemIds.length;
          if (sortOrder === 'asc') {
            return aCount - bCount;
          } else {
            return bCount - aCount;
          }
        });
      }
      
      setComparisons(comparisonsData);
      setError(null);
    } catch (err) {
      console.error('Error loading comparisons:', err);
      setError('Failed to load comparisons');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComparison = (id: string) => {
    setComparisonToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!comparisonToDelete) return;

    try {
      await comparisonService.deleteComparison(comparisonToDelete);
      loadComparisons();
      setDeleteDialogOpen(false);
      setComparisonToDelete(null);
    } catch (err) {
      setError('Failed to delete comparison');
      console.error('Error deleting comparison:', err);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setComparisonToDelete(null);
  };

  const handleViewComparison = (comparison: Comparison) => {
    // Navigate based on comparison type
    switch (comparison.type) {
      case 'trainings':
        navigate(`/trainings/compare?ids=${comparison.itemIds.join(',')}`);
        break;
      case 'tests':
        navigate(`/test-results/compare?ids=${comparison.itemIds.join(',')}`);
        break;
      case 'benchmarks':
        // For now, navigate to benchmarks page - could be enhanced later
        navigate('/benchmarks');
        break;
      case 'epochs':
        // For now, navigate to epochs page - could be enhanced later
        navigate('/epochs');
        break;
      default:
        // Default to trainings comparison
        navigate(`/trainings/compare?ids=${comparison.itemIds.join(',')}`);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trainings':
        return 'primary';
      case 'tests':
        return 'secondary';
      case 'benchmarks':
        return 'success';
      case 'epochs':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading && comparisons.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Comparisons
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => {
                loadComparisons();
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Comparisons Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => handleSort('name')}
                >
                  Name
                  {sortBy === 'name' && (
                    sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                  )}
                </Box>
              </TableCell>
              <TableCell>Description</TableCell>
              <TableCell>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => handleSort('type')}
                >
                  Type
                  {sortBy === 'type' && (
                    sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => handleSort('itemCount')}
                >
                  Items Count
                  {sortBy === 'itemCount' && (
                    sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => handleSort('createdAt')}
                >
                  Created At
                  {sortBy === 'createdAt' && (
                    sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                  )}
                </Box>
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comparisons.map((comparison) => (
              <TableRow
                key={comparison._id}
                onClick={() => handleViewComparison(comparison)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <TableCell>
                  <Typography variant="body2">
                    {comparison.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {comparison.description || 'No description'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={comparison.type}
                    color={getTypeColor(comparison.type)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {comparison.itemIds.length} item{comparison.itemIds.length !== 1 ? 's' : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  {formatTimestamp(comparison.createdAt)}
                </TableCell>
                <TableCell>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComparison(comparison._id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {comparisons.length === 0 && !loading && (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">
            No comparisons found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Create comparisons from training, test, or benchmark views to see them here
          </Typography>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Comparison</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this comparison? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComparisonsPage;