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
import { Group, getUserGroups } from '../services/groupService';

interface GroupSelectorProps {
  value?: string;
  onChange: (groupId?: string) => void;
  label?: string;
  includePersonal?: boolean;
  includeNone?: boolean;
  disabled?: boolean;
}

const GroupSelector: React.FC<GroupSelectorProps> = ({
  value,
  onChange,
  label = 'Share with Group',
  includePersonal = true,
  includeNone = true,
  disabled = false
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          Loading groups...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning">
        {error}
      </Alert>
    );
  }

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        label={label}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        {includeNone && (
          <MenuItem value="">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>No group (private)</Typography>
              <Chip label="Private" size="small" color="default" />
            </Box>
          </MenuItem>
        )}
        
        {includePersonal && (
          <MenuItem value="personal">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>Personal only</Typography>
              <Chip label="Personal" size="small" color="primary" />
            </Box>
          </MenuItem>
        )}

        {groups.map((group) => (
          <MenuItem key={group._id} value={group._id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>{group.name}</Typography>
              {group.isOwner && (
                <Chip label="Owner" size="small" color="secondary" />
              )}
              {group.memberCount && (
                <Chip 
                  label={`${group.memberCount} members`} 
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

export default GroupSelector;
