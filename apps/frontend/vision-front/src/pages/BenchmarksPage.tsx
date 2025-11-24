import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import { Benchmark } from '@/types';
import { benchmarkService } from '@/services/benchmarkService';

const BenchmarksPage: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBenchmarks();
  }, []);

  const loadBenchmarks = async () => {
    try {
      setLoading(true);
      const response = await benchmarkService.getBenchmarks({
        page: 1,
        limit: 100,
        sortBy: 'timestamp',
        order: 'desc',
      });
      setBenchmarks(response.data.benchmarks || []);
      setError(null);
    } catch (err) {
      console.error('Error loading benchmarks:', err);
      setError('Failed to load benchmarks');
    } finally {
      setLoading(false);
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

  if (loading && benchmarks.length === 0) {
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
          Benchmarks
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => {
                loadBenchmarks();
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

      {/* Benchmarks Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Model Count</TableCell>
              <TableCell>Epoch</TableCell>
              <TableCell>Device</TableCell>
              <TableCell>Framework</TableCell>
              <TableCell>Avg FPS</TableCell>
              <TableCell>Mean Time (ms)</TableCell>
              <TableCell>GPU Memory (GB)</TableCell>
              <TableCell>CPU Memory (GB)</TableCell>
              <TableCell>Total Params (M)</TableCell>
              <TableCell>Image Size</TableCell>
              <TableCell>FLOPs (G)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {benchmarks.map((benchmark) => 
              benchmark.results.map((result, resultIndex) => {
                // Calculate metrics for this specific result
                const fps = result.fps || 0;
                
                // Get timing information from result data
                const meanTime = result.mean_time_ms || (fps > 0 ? 1000 / fps : 0);
                const stdTime = result.std_time_ms || 0;
                
                // Get memory values for this result - try multiple fields
                const cpuMemory = (result.ram_memory_mean_mb || result.ram_memory_max_mb || result.baseline_ram_memory_mb || 0) / 1024; // Convert MB to GB
                const gpuMemory = (result.gpu_memory_mean_mb || result.gpu_memory_max_mb || result.baseline_gpu_memory_mb || 0) / 1024; // Convert MB to GB
                
                // Debug memory values
                console.log(`Result ${resultIndex} for benchmark ${benchmark._id}:`, {
                  device: result.device,
                  ram_memory_mean_mb: result.ram_memory_mean_mb,
                  ram_memory_max_mb: result.ram_memory_max_mb,
                  baseline_ram_memory_mb: result.baseline_ram_memory_mb,
                  gpu_memory_mean_mb: result.gpu_memory_mean_mb,
                  gpu_memory_max_mb: result.gpu_memory_max_mb,
                  baseline_gpu_memory_mb: result.baseline_gpu_memory_mb,
                  calculated_cpu_gb: cpuMemory,
                  calculated_gpu_gb: gpuMemory
                });
                
                // Model metrics from this result
                const totalParamsM = result.total_parameters ? (result.total_parameters / 1000000).toFixed(2) : 'N/A';
                const imageSize = result.image_size || 'N/A';
                const flopsG = result.flops_giga ? result.flops_giga.toFixed(2) : 'N/A';

                return (
                  <TableRow key={`${benchmark._id}-${resultIndex}`}>
                    <TableCell>
                      {benchmark.training_uuid ? (
                        <Link 
                          to={`/trainings/${benchmark.training_uuid}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {formatTimestamp(benchmark.timestamp)}
                        </Link>
                      ) : (
                        formatTimestamp(benchmark.timestamp)
                      )}
                    </TableCell>
                    <TableCell>{benchmark.results.length}</TableCell>
                    <TableCell>{benchmark.epoch || 'N/A'}</TableCell>
                    <TableCell>{result.device || 'N/A'}</TableCell>
                    <TableCell>{result.backbone || 'N/A'}</TableCell>
                    <TableCell>{fps.toFixed(2)}</TableCell>
                    <TableCell>
                      {meanTime > 0 ? `${meanTime.toFixed(2)} ± ${stdTime.toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>{gpuMemory.toFixed(2)}</TableCell>
                    <TableCell>{cpuMemory.toFixed(2)}</TableCell>
                    <TableCell>{totalParamsM}</TableCell>
                    <TableCell>{imageSize}</TableCell>
                    <TableCell>{flopsG}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small">
                          <BarChartIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteBenchmark(benchmark._id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {benchmarks.length === 0 && !loading && (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="textSecondary">
            No benchmarks found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Benchmarks will appear here when available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default BenchmarksPage;