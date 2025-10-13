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
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { datasetService } from '../services/datasetService';
import { Dataset } from '../types';

const DatasetsPage: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['datasets', page + 1, rowsPerPage, debouncedSearch],
    queryFn: () => datasetService.getDatasets({
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch || undefined,
      sortBy: 'updatedAt',
      order: 'desc'
    })
  });

  const datasets = data?.data?.datasets || [];
  const total = data?.data?.pagination?.total || 0;

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Datasets
        </Typography>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Search datasets by name or description..."
          value={searchTerm}
          onChange={(e: any) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : 'Failed to load datasets'}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : datasets.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No datasets found matching your search' : 'No datasets available'}
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
                  <TableCell align="right"><strong>Total Frames</strong></TableCell>
                  <TableCell align="right"><strong>Total Pixels</strong></TableCell>
                  <TableCell align="center"><strong>Classes</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell align="center"><strong>Info</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {datasets.map((dataset: Dataset) => (
                  <TableRow key={dataset._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {dataset.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                        {dataset.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {dataset.annotations?.total_frames ? formatNumber(dataset.annotations.total_frames) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {dataset.annotations?.total_pixels ? formatNumber(dataset.annotations.total_pixels) : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {dataset.annotations?.class_distribution ? (
                        <Chip
                          label={Object.keys(dataset.annotations.class_distribution).length}
                          size="small"
                          color="default"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(dataset.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View dataset details">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
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

export default DatasetsPage;
