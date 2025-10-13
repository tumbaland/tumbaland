import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import { Training } from '../types';

const TrainingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  const handleStatusFilterChange = (_event: React.MouseEvent<HTMLElement>, newStatus: string | null) => {
    if (newStatus !== null) {
      setStatusFilter(newStatus);
      setPage(0);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: Training['status']): 'success' | 'error' | 'default' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'default';
      case 'failed':
        return 'error';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Training Runs
        </Typography>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box mb={3} display="flex" gap={2} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search trainings by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, maxWidth: 500 }}
        />
        
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          aria-label="status filter"
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="pending">Pending</ToggleButton>
          <ToggleButton value="running">Running</ToggleButton>
          <ToggleButton value="completed">Completed</ToggleButton>
          <ToggleButton value="failed">Failed</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : 'Failed to load training runs'}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : trainings.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm || statusFilter !== 'all' 
              ? 'No trainings found matching your filters' 
              : 'No training runs available'}
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Dataset</strong></TableCell>
                  <TableCell align="center"><strong>Status</strong></TableCell>
                  <TableCell><strong>Model</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell><strong>Updated</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trainings.map((training: Training) => (
                  <TableRow 
                    key={training._id} 
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/trainings/${training._id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {training.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 250 }}>
                        {training.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {training.datasetId || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={training.status}
                        color={getStatusColor(training.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {training.configuration?.model_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(training.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(training.updatedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View training details">
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/trainings/${training._id}`);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}
    </Container>
  );
};

export default TrainingsPage;
