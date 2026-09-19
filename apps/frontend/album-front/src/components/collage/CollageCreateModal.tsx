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
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CollageInput } from '../../types/collage';
import { useAlbums } from '../../hooks/useAlbums';
import { gradient, useTenantFilter } from '@tumbaland/components';
import { DEFAULT_BACKGROUND, DEFAULT_FRAME_COLOR } from './collageDoc';

interface CollageCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CollageInput) => Promise<void>;
}

const defaultConfig = {
  version: '2.0',
  date: new Date().toISOString(),
  // 16:9 design space; the editor scales it to fit whatever screen it opens on
  viewport: { width: 1600, height: 900 },
  theme: 'default',
  photos: [],
  texts: [],
  title: { text: '', subtitle: '' },
  backgroundColor: DEFAULT_BACKGROUND,
  borderColor: DEFAULT_FRAME_COLOR,
  photoTransparencyMode: false
};

/** They make one collage per month — suggest e.g. "July 2026" as the title. */
const suggestedTitle = () => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const CollageCreateModal: React.FC<CollageCreateModalProps> = ({ open, onClose, onCreate }) => {
  const [title, setTitle] = useState(suggestedTitle);
  const [subtitle, setSubtitle] = useState('');
  const [albumIds, setAlbumIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context
  const {
    albums,
    loading: albumsLoading,
    fetchAlbums
  } = useAlbums({
    groupId: tenantGroupId, // Pass groupId only if present (group context), undefined for personal
    includeCover: false
  });

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (albumIds.length === 0) {
      // the backend rejects collages without a source album
      setError('Pick at least one source album');
      return;
    }

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
      setTitle(suggestedTitle());
      setSubtitle('');
      setAlbumIds([]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create collage');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle(suggestedTitle());
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>New Collage</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Collage Title"
          fullWidth
          variant="outlined"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{
            mb: 2,
            mt: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />

        <TextField
          margin="dense"
          label="Subtitle / Description"
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />

        <FormControl fullWidth margin="dense" disabled={albumsLoading || loading}>
          <InputLabel id="album-select-label">Source Albums</InputLabel>
          <Select
            labelId="album-select-label"
            multiple
            value={albumIds}
            label="Source Albums"
            onChange={(e) => setAlbumIds(e.target.value as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const album = albums.find((a) => a._id === value);
                  return <Chip key={value} label={album?.name || value} size="small" sx={{ borderRadius: 1 }} />;
                })}
              </Box>
            )}
            endAdornment={
              <InputAdornment position="end" sx={{ mr: 2 }}>
                <IconButton onClick={handleRefreshAlbums} disabled={albumsLoading} size="small">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            }
            sx={{ borderRadius: 2 }}
          >
            {albums.map((album) => (
              <MenuItem key={album._id} value={album._id}>
                {album.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: gradient.brand,
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(139, 92, 246, 0.4)'
            }
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : 'Create Collage'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
