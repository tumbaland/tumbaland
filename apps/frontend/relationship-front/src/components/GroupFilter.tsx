import React, { useEffect, useState } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Public as PublicIcon
} from '@mui/icons-material';
import { Group, getUserGroups } from '../services/groupService';

interface GroupFilterProps {
  value?: string;
  onChange: (groupId?: string) => void;
  showCounts?: boolean;
}

const GroupFilter: React.FC<GroupFilterProps> = ({
  value,
  onChange,
  showCounts = false
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        const userGroups = await getUserGroups();
        setGroups(userGroups);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load groups');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} py={1}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading filters...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning">
        Unable to load group filters
      </Alert>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterIcon fontSize="small" />
          Filter by Group
        </Box>
      </InputLabel>
      <Select
        value={value || 'all'}
        label="Filter by Group"
        onChange={(e) => onChange(e.target.value === 'all' ? undefined : e.target.value)}
      >
        <MenuItem value="all">
          <Box display="flex" alignItems="center" gap={1}>
            <PublicIcon fontSize="small" />
            <Typography>All Activities</Typography>
          </Box>
        </MenuItem>
        
        <MenuItem value="personal">
          <Box display="flex" alignItems="center" gap={1}>
            <PersonIcon fontSize="small" />
            <Typography>My Activities</Typography>
            <Chip label="Personal" size="small" color="primary" />
          </Box>
        </MenuItem>

        {groups.map((group) => (
          <MenuItem key={group._id} value={group._id}>
            <Box display="flex" alignItems="center" gap={1}>
              <GroupIcon fontSize="small" />
              <Typography>{group.name}</Typography>
              {group.isOwner && (
                <Chip label="Owner" size="small" color="secondary" />
              )}
              {showCounts && group.memberCount && (
                <Chip 
                  label={`${group.memberCount}`} 
                  size="small" 
                  variant="outlined" 
                />
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default GroupFilter;
