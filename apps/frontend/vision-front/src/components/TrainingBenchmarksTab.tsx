import React, { useState, useEffect } from 'react';
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Benchmark } from '../types';
import { benchmarkService } from '../services/benchmarkService';

interface TrainingBenchmarksTabProps {
  training_uuid: string;
}

const TrainingBenchmarksTab: React.FC<TrainingBenchmarksTabProps> = ({ training_uuid }) => {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    loadBenchmarks();
  }, [training_uuid]);

  const loadBenchmarks = async () => {
    try {
      setLoading(true);
      const response = await benchmarkService.getBenchmarks({
        training_uuid,
        sortBy: 'timestamp',
        order: 'desc',
      });
      setBenchmarks(response.data.benchmarks || []);
      setError(null);
    } catch (err) {
      setError('Failed to load benchmarks');
      console.error('Error loading benchmarks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBenchmark = async () => {
    if (!jsonInput.trim()) return;

    try {
      setUploading(true);
      const benchmarkData = JSON.parse(jsonInput);
      // Ensure the benchmark is associated with this training
      benchmarkData.training_uuid = training_uuid;
      await benchmarkService.uploadBenchmark(benchmarkData);
      setUploadDialogOpen(false);
      setJsonInput('');
      loadBenchmarks();
    } catch (err) {
      setError('Failed to upload benchmark. Please check the JSON format.');
      console.error('Error uploading benchmark:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBenchmark = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this benchmark?')) return;

    try {
      await benchmarkService.deleteBenchmark(id);
      loadBenchmarks();
    } catch (err) {
      setError('Failed to delete benchmark');
      console.error('Error deleting benchmark:', err);
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

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" component="h2">
          Training Benchmarks
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadBenchmarks}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Add Benchmark
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {benchmarks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No benchmarks found for this training
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Upload benchmark data to track model performance metrics
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Model Name</TableCell>
                <TableCell>Parameters</TableCell>
                <TableCell>FLOPs</TableCell>
                <TableCell>FPS</TableCell>
                <TableCell>Memory (GB)</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Framework</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {benchmarks.map((benchmark) =>
                benchmark.results.map((result: any, index: number) => (
                  <TableRow key={`${benchmark._id}-${index}`}>
                    {index === 0 && (
                      <TableCell rowSpan={benchmark.results.length}>
                        {formatTimestamp(benchmark.timestamp)}
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        label={result.model_name || 'Unknown'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatNumber(result.parameters)}</TableCell>
                    <TableCell>{formatNumber(result.flops)}</TableCell>
                    <TableCell>{result.fps?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell>{result.memory_usage?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell>{result.device || 'N/A'}</TableCell>
                    <TableCell>{result.framework || 'N/A'}</TableCell>
                    {index === 0 && (
                      <TableCell rowSpan={benchmark.results.length}>
                        <Tooltip title="Delete Benchmark">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteBenchmark(benchmark._id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Benchmark</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Benchmark JSON"
            fullWidth
            multiline
            rows={20}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`Paste your benchmark JSON here. The training_uuid will be automatically set.

Example format:
{
  "timestamp": "2024-01-01T12:00:00Z",
  "system_info": {
    "cpu": "Intel i7",
    "memory": "32GB",
    "gpu": {
      "gpu_0": {
        "memory_max_gb": 8,
        "gpu_utilization_percent": 85
      }
    }
  },
  "results": [
    {
      "model_name": "yolov8n",
      "parameters": 3150000,
      "flops": 8500000000,
      "fps": 45.2,
      "memory_usage": 2.1,
      "device": "GPU",
      "framework": "PyTorch"
    }
  ]
}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUploadBenchmark}
            variant="contained"
            disabled={uploading || !jsonInput.trim()}
          >
            {uploading ? <CircularProgress size={20} /> : 'Add Benchmark'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainingBenchmarksTab;