import React, { useCallback, useState, useEffect } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Button,
  Paper,
  Chip,
  Typography
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { ActivityType } from '../api/types';
import { getActivityTypes } from '../api/activityTypes';
import { useTenantFilter } from './tenant/useTenantDataRefresh';

export interface ActivityFilters {
  activityType?: string; // ActivityType slug
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface ActivitiesFilterProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onClearFilters: () => void;
}

const ActivitiesFilter: React.FC<ActivitiesFilterProps> = React.memo(({
  filters,
  onFiltersChange,
  onClearFilters
}) => {
  // Local state for description input to avoid immediate filtering
  const [localDescription, setLocalDescription] = useState(filters.description || '');
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Get current tenant context for filtering
  const tenantGroupId = useTenantFilter();

  // Fetch activity types on component mount and when tenant changes
  useEffect(() => {
    const fetchActivityTypes = async () => {
      try {
        console.log('Fetching activity types for groupId:', tenantGroupId);
        const response = await getActivityTypes({ groupId: tenantGroupId });
        setActivityTypes(response.data);
        console.log('Fetched activity types:', response.data);
      } catch (error) {
        console.error('Failed to fetch activity types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchActivityTypes();
  }, [tenantGroupId]);

  const handleFilterChange = useCallback((key: keyof ActivityFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    });
  }, [filters, onFiltersChange]);

  // Update local state when filters change externally (e.g., clear all)
  useEffect(() => {
    setLocalDescription(filters.description || '');
  }, [filters.description]);

  // Debounce effect: Apply filter automatically after user stops typing for 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDescription !== filters.description) {
        handleFilterChange('description', localDescription);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [localDescription, filters.description, handleFilterChange]);

  // Handle description input change (only update local state)
  const handleDescriptionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDescription(event.target.value);
  }, []);

  // Handle description search on Enter key
  const handleDescriptionKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleFilterChange('description', localDescription);
    }
  }, [localDescription, handleFilterChange]);

  // Handle description blur (when user clicks away)
  const handleDescriptionBlur = useCallback(() => {
    handleFilterChange('description', localDescription);
  }, [localDescription, handleFilterChange]);

  const getActiveFiltersCount = useCallback(() => {
    return Object.values(filters).filter(value => value && value !== '').length;
  }, [filters]);

  const hasActiveFilters = getActiveFiltersCount() > 0;

  const renderFilterChips = useCallback(() => {
    const chips = [];
    
    if (filters.activityType) {
      const activityLabel = activityTypes?.find(type => type.slug === filters.activityType)?.name || filters.activityType;
      chips.push(
        <Chip
          key="activityType"
          label={`Type: ${activityLabel}`}
          onDelete={() => handleFilterChange('activityType', undefined)}
          size="small"
          color="primary"
          variant="outlined"
        />
      );
    }
    
    if (filters.startDate) {
      chips.push(
        <Chip
          key="startDate"
          label={`From: ${new Date(filters.startDate).toLocaleDateString()}`}
          onDelete={() => handleFilterChange('startDate', undefined)}
          size="small"
          color="primary"
          variant="outlined"
        />
      );
    }
    
    if (filters.endDate) {
      chips.push(
        <Chip
          key="endDate"
          label={`To: ${new Date(filters.endDate).toLocaleDateString()}`}
          onDelete={() => handleFilterChange('endDate', undefined)}
          size="small"
          color="primary"
          variant="outlined"
        />
      );
    }
    
    if (filters.description) {
      chips.push(
        <Chip
          key="description"
          label={`Search: "${filters.description}"`}
          onDelete={() => {
            handleFilterChange('description', undefined);
            setLocalDescription('');
          }}
          size="small"
          color="primary"
          variant="outlined"
        />
      );
    }
    
    return chips;
  }, [filters, handleFilterChange]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: hasActiveFilters ? 2 : 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon color="action" />
          <Typography variant="h6" component="span">
            Filters
          </Typography>
          {hasActiveFilters && (
            <Chip
              label={getActiveFiltersCount()}
              size="small"
              color="primary"
              sx={{ minWidth: 24, height: 24 }}
            />
          )}
        </Box>
        
        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={onClearFilters}
            sx={{ minWidth: 'auto' }}
          >
            Clear All
          </Button>
        )}
      </Box>

      {hasActiveFilters && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {renderFilterChips()}
        </Box>
      )}

      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: '1fr 1fr', 
            md: '1fr 1fr 1fr 1fr' 
          },
          gap: 2
        }}
      >
        <FormControl fullWidth size="small">
          <InputLabel>Activity Type</InputLabel>
          <Select
            value={filters.activityType || ''}
            onChange={(e) => handleFilterChange('activityType', e.target.value)}
            label="Activity Type"
            disabled={loadingTypes}
          >
            <MenuItem value="">
              <em>All Types</em>
            </MenuItem>
            {activityTypes && activityTypes.map((type) => (
              <MenuItem key={type._id} value={type.slug}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          label="Start Date"
          type="date"
          value={filters.startDate || ''}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
          InputLabelProps={{
            shrink: true,
          }}
        />

        <TextField
          fullWidth
          size="small"
          label="End Date"
          type="date"
          value={filters.endDate || ''}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
          InputLabelProps={{
            shrink: true,
          }}
        />

        <TextField
          fullWidth
          size="small"
          label="Search Description"
          value={localDescription}
          onChange={handleDescriptionChange}
          onKeyPress={handleDescriptionKeyPress}
          onBlur={handleDescriptionBlur}
          placeholder="Type to search descriptions..."
        />
      </Box>
    </Paper>
  );
});

export default ActivitiesFilter;