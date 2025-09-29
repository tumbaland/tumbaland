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
  InputAdornment
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CollageInput } from '../../types/collage';
import { useAlbums } from '../../hooks/useAlbums';
import { useTenantFilter } from '../../components/tenant';

interface CollageCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CollageInput) => Promise<void>;
}

const defaultConfig = {
  version: '1.0',
  date: new Date().toISOString(),
  viewport: { width: 1200, height: 800 },
  theme: 'default',
  photos: [],
  textSections: [],
  title: { text: '', subtitle: '' }
};

export const CollageCreateModal: React.FC<CollageCreateModalProps> = ({ open, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [albumIds, setAlbumIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context
  const { albums, loading: albumsLoading, fetchAlbums } = useAlbums({
    groupId: tenantGroupId, // Pass groupId only if present (group context), undefined for personal
    includeCover: false
  });

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCreate({
        title,
        config: {
          ...defaultConfig,
          title: { text: title, subtitle }
        },
        albumIds,
        groupId: tenantGroupId // Include the active group ID from tenant context
      });
      setTitle('');
      setSubtitle('');
      setAlbumIds([]);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create collage');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setSubtitle('');
      setAlbumIds([]);
      setError(null);
      onClose();
    }
  };

  const handleRefreshAlbums = () => {
    fetchAlbums();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Collage</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense" disabled={albumsLoading || loading}>
          <InputLabel id="album-select-label">Albums</InputLabel>
          <Select
            labelId="album-select-label"
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
          <Box color="error.main" mt={1}>
            {error}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleCreate} variant="contained" color="primary" disabled={loading || !title || albumIds.length === 0}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
