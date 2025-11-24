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
import { Benchmark, BenchmarkResult } from '@/types';
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
      setBenchmarks(response.data.data.benchmarks || []);
      setError(null);
    } catch (err) {
      setError('Failed to load benchmarks');
      console.error('Error loading benchmarks:', err);
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

  const calculateMeanAndStd = (values: number[]) => {
    if (values.length === 0) return { mean: 0, std: 0 };
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    return { mean, std };
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
            {benchmarks.map((benchmark) => {
              const avgFps = benchmark.results.reduce((sum: number, r: BenchmarkResult) => sum + (r.fps || 0), 0) / benchmark.results.length;
              
              // Calculate mean time and std from FPS values
              const fpsValues = benchmark.results.map(r => r.fps || 0).filter(fps => fps > 0);
              const timeValues = fpsValues.map(fps => 1000 / fps); // Convert FPS to milliseconds
              const { mean: meanTime, std: stdTime } = calculateMeanAndStd(timeValues);
              
              const gpuMemory = benchmark.system_info.gpu?.gpu_0?.memory_used_gb || 0;
              const cpuMemory = benchmark.system_info.memory_used_gb || 0;
              
              // Model metrics from first result
              const firstResult = benchmark.results[0];
              const totalParamsM = firstResult?.parameters ? (firstResult.parameters / 1000000).toFixed(2) : 'N/A';
              const imageSize = firstResult?.input_size || 'N/A';
              const flopsG = firstResult?.flops ? (firstResult.flops / 1000000000).toFixed(2) : 'N/A';

              return (
            <TableRow key={benchmark._id}>
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
              <TableCell>{benchmark.results[0]?.device || 'N/A'}</TableCell>
              <TableCell>{benchmark.results[0]?.framework || 'N/A'}</TableCell>
                  <TableCell>{avgFps.toFixed(2)}</TableCell>
                  <TableCell>
                    {meanTime > 0 ? `${meanTime.toFixed(2)} ± ${stdTime.toFixed(2)}` : 'N/A'}
                  </TableCell>
                  <TableCell>{gpuMemory > 0 ? gpuMemory.toFixed(2) : 'N/A'}</TableCell>
                  <TableCell>{cpuMemory > 0 ? cpuMemory.toFixed(2) : 'N/A'}</TableCell>
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
            })}
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