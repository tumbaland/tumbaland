import React, { useState, useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { useActivities } from '../hooks/useActivities';
import AddActivityModal from '../components/AddActivityModal';
import ActivitiesTable from '../components/ActivitiesTable';
import ActivitiesFilter, { ActivityFilters } from '../components/ActivitiesFilter';
import { useTenantFilter } from '../components/tenant';

const Activities: React.FC = () => {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [filters, setFilters] = useState<ActivityFilters>({});
  
  // Get the current tenant's group ID
  const tenantGroupId = useTenantFilter();

  // Construct the filters object for useActivities
  const activitiesFilters = useMemo(() => ({
    page: 1,
    limit: rowsPerPage,
    sortBy,
    sortOrder,
    groupId: tenantGroupId,
    // Apply filters
    activityType: filters.activityType,
    startDate: filters.startDate,
    endDate: filters.endDate,
    description: filters.description
  }), [rowsPerPage, sortBy, sortOrder, tenantGroupId, filters]);

  const {
    activities = [],
    loading,
    error,
    refetch
  } = useActivities(activitiesFilters);

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (value === -1) {
      setRowsPerPage(10000); // Set to a very high number to load all
    } else {
      setRowsPerPage(value);
    }
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(field);
  };

  const handleFiltersChange = (newFilters: ActivityFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box
        sx={{
          p: 3,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: { xs: 'flex-start', sm: 'space-between' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3
        }}
      >
        <Typography variant="h4" component="h1" sx={{ mb: { xs: 1, sm: 0 } }}>
          Activities Together
        </Typography>
        <AddActivityModal onActivityAdded={refetch} />
      </Box>

      <ActivitiesFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      <Paper
        sx={{
          width: '100%',
          overflowX: 'auto',
          boxShadow: { xs: 'none', sm: undefined }
        }}
      >
        <ActivitiesTable
          activities={activities}
          sortBy={sortBy}
          sortOrder={sortOrder}
          handleSort={handleSort}
          formatDate={formatDate}
          refetch={refetch}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>
    </Box>
  );
};

export default Activities;
