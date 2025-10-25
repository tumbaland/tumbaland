import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Box,
  Typography,
  Alert,
  Checkbox,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Compare as CompareIcon
} from '@mui/icons-material';
import { getAllAnalyses, DatasetAnalysis, deleteAnalysis } from '../services/analysisService';

interface AnalysisTableProps {
  selectedAnalysisIds?: Set<string>;
  onSelectAnalysis?: (analysisId: string) => void;
  onSelectAll?: (allIds: string[]) => void;
  onCompareSelected?: () => void;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  selectedAnalysisIds = new Set(),
  onSelectAnalysis = () => {},
  onSelectAll = () => {},
  onCompareSelected = () => {}
}) => {
  const [analyses, setAnalyses] = useState<DatasetAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DatasetAnalysis | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleOpenDetails = (analysis: DatasetAnalysis) => {
    setSelectedAnalysis(analysis);
  };

  const handleCloseDetails = () => {
    setSelectedAnalysis(null);
  };

  const handleDeleteClick = (analysis: DatasetAnalysis) => {
    setSelectedAnalysis(analysis);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAnalysis) return;

    try {
      setDeleteLoading(true);
      await deleteAnalysis(selectedAnalysis._id);
      setAnalyses(analyses.filter((a) => a._id !== selectedAnalysis._id));
      setDeleteConfirmOpen(false);
      setSelectedAnalysis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete analysis');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedAnalysisIds.size > 1 && (
            <Button
              variant="contained"
              startIcon={<CompareIcon />}
              onClick={onCompareSelected}
              color="primary"
              size="small"
            >
              Compare
            </Button>
          )}
        </Box>
      </Box>

      {/* Bulk Selection UI */}
      {selectedAnalysisIds.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedAnalysisIds.size} analysis(es) selected
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>
                <Checkbox
                  indeterminate={
                    selectedAnalysisIds.size > 0 && selectedAnalysisIds.size < analyses.length
                  }
                  checked={analyses.length > 0 && selectedAnalysisIds.size === analyses.length}
                  onChange={() => {
                    if (selectedAnalysisIds.size === analyses.length) {
                      // Deselect all
                      onSelectAll?.([]);
                    } else {
                      // Select all
                      onSelectAll?.(analyses.map(a => a._id));
                    }
                  }}
                  disabled={analyses.length === 0}
                />
              </TableCell>
              <TableCell>
                <strong>Dataset</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Frames</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Total Pixels</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Classes</strong>
              </TableCell>
              <TableCell>
                <strong>Dimensions</strong>
              </TableCell>
              <TableCell>
                <strong>Timestamp</strong>
              </TableCell>
              <TableCell align="center">
                <strong>Actions</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {analyses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No analyses found
                </TableCell>
              </TableRow>
            ) : (
              analyses.map((analysis) => (
                <TableRow
                  key={analysis._id}
                  hover
                  selected={selectedAnalysisIds.has(analysis._id)}
                  sx={{
                    backgroundColor: selectedAnalysisIds.has(analysis._id)
                      ? 'rgba(25, 118, 210, 0.08)'
                      : 'inherit'
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedAnalysisIds.has(analysis._id)}
                      onChange={() => onSelectAnalysis(analysis._id)}
                    />
                  </TableCell>
                  <TableCell>{analysis.dataset}</TableCell>
                  <TableCell align="right">{analysis.total_frames.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {(analysis.total_pixels / 1000000).toFixed(2)}M
                  </TableCell>
                  <TableCell align="right">{analysis.total_classes}</TableCell>
                  <TableCell>
                    {analysis.image_dimensions.width}x{analysis.image_dimensions.height}
                  </TableCell>
                  <TableCell>{new Date(analysis.timestamp).toLocaleString()}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="View analysis details">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDetails(analysis)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete analysis">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(analysis)}
                        disabled={deleteLoading}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Details Dialog */}
      <Dialog open={!!selectedAnalysis && !deleteConfirmOpen} onClose={handleCloseDetails} maxWidth="lg" fullWidth>
        <DialogTitle>Analysis Details - {selectedAnalysis?.dataset}</DialogTitle>
        <DialogContent>
          {selectedAnalysis && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Overview
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Box>
                  <Typography color="textSecondary">Frames:</Typography>
                  <Typography variant="h6">{selectedAnalysis.total_frames.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography color="textSecondary">Total Pixels:</Typography>
                  <Typography variant="h6">
                    {(selectedAnalysis.total_pixels / 1000000).toFixed(2)}M
                  </Typography>
                </Box>
                <Box>
                  <Typography color="textSecondary">Classes:</Typography>
                  <Typography variant="h6">{selectedAnalysis.total_classes}</Typography>
                </Box>
                <Box>
                  <Typography color="textSecondary">Dimensions:</Typography>
                  <Typography variant="h6">
                    {selectedAnalysis.image_dimensions.width}x{selectedAnalysis.image_dimensions.height}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>
                Class Analysis
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>
                        <strong>Class Name</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Pixels</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>% of Total</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Frames</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Frame Coverage</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedAnalysis.class_analysis.map((cls) => (
                      <TableRow key={cls.class_id}>
                        <TableCell>{cls.name}</TableCell>
                        <TableCell align="right">{cls.total_pixels.toLocaleString()}</TableCell>
                        <TableCell align="right">{cls.pixel_percentage.toFixed(4)}%</TableCell>
                        <TableCell align="right">{cls.frames_with_class.toLocaleString()}</TableCell>
                        <TableCell align="right">{cls.frame_coverage_percentage.toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Analysis</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this analysis?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalysisTable;
