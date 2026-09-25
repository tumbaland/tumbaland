import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  useMediaQuery,
  useTheme
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Collage } from '../../types/collage';
import { useAllAlbums } from '../../hooks/useAlbums';
import { useTenantFilter } from '@tumbaland/frontend-core';

/**
 * The details this dialog edits. Never the layout: that may be being edited by
 * someone else right now, and this dialog's copy of it could be minutes old.
 */
export interface CollageDetailsInput {
  title: string;
  subtitle: string;
  albumIds: string[];
  groupId?: string;
}

interface CollageEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: CollageDetailsInput) => Promise<void>;
  initialData: Collage;
}

export const CollageEditModal: React.FC<CollageEditModalProps> = ({ open, onClose, onSave, initialData }) => {
  // A phone: the whole screen, with room for the keyboard.
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [title, setTitle] = useState(initialData.title);
  const [subtitle, setSubtitle] = useState(initialData.config?.title?.subtitle || '');
  const [albumIds, setAlbumIds] = useState<string[]>(initialData.albumIds || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context
  const {
    albums,
    loading: albumsLoading,
    fetchAlbums
  } = useAllAlbums({
    groupId: tenantGroupId, // Pass groupId only if present (group context), undefined for personal
    includeCover: false
  });

  React.useEffect(() => {
    setTitle(initialData.title);
    setSubtitle(initialData.config?.title?.subtitle || '');
    setAlbumIds(initialData.albumIds || []);
    setError(null);
  }, [initialData, open]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave({
        title,
        subtitle,
        albumIds,
        groupId: tenantGroupId // Include the active group ID from tenant context
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update collage');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAlbums = () => {
    fetchAlbums();
  };

  return (
    <Dialog open={open} fullScreen={fullScreen} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Collage</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" disabled={albumsLoading || loading}>
          <InputLabel id="album-edit-select-label">Albums</InputLabel>
          <Select
            labelId="album-edit-select-label"
            multiple
            value={albumIds}
            label="Albums"
            onChange={(e) => setAlbumIds(e.target.value as string[])}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={handleRefreshAlbums}
                  disabled={albumsLoading || loading}
                  size="small"
                  sx={{ mr: 2 }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            }
          >
            {albums.map((album) => (
              <MenuItem key={album._id} value={album._id}>
                {album.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoFocus
          margin="dense"
          label="Title"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Subtitle"
          fullWidth
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          disabled={loading}
        />
        {error && (
          <Box
            sx={{
              color: 'error.main',
              mt: 1
            }}
          >
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !title || albumIds.length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
