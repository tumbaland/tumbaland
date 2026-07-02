import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';

interface CreateAlbumDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (albumData: { name: string; description: string; tags: string[]; groupId?: string }) => Promise<void>;
  tenantGroupId?: string;
}

const CreateAlbumDialog: React.FC<CreateAlbumDialogProps> = ({
  open,
  onClose,
  onCreate,
  tenantGroupId
}) => {
  const [newAlbum, setNewAlbum] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    groupId: undefined as string | undefined
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateAlbum = async () => {
    if (!newAlbum.name.trim()) {
      setError('Album name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await onCreate({ ...newAlbum, groupId: tenantGroupId });
      setNewAlbum({ name: '', description: '', tags: [], groupId: undefined });
      setTagInput('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album');
    } finally {
      setCreating(false);
    }
  };

  const handleAddTag = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && tagInput.trim()) {
      event.preventDefault();
      const tag = tagInput.trim();
      if (!newAlbum.tags.includes(tag)) {
        setNewAlbum((prev) => ({
          ...prev,
          tags: [...prev.tags, tag]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewAlbum((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove)
    }));
  };

  const handleClose = () => {
    if (!creating) {
      onClose();
    }
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
      <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>Create New Album</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Album Name"
          fullWidth
          variant="outlined"
          value={newAlbum.name}
          onChange={(e) => setNewAlbum((prev) => ({ ...prev, name: e.target.value }))}
          sx={{ 
            mb: 2, 
            mt: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />

        <TextField
          margin="dense"
          label="Description (optional)"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          value={newAlbum.description}
          onChange={(e) => setNewAlbum((prev) => ({ ...prev, description: e.target.value }))}
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />

        <Box sx={{ mb: 2 }}>
          {tenantGroupId ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This album will be created in your selected group context
            </Alert>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This album will be created in your personal context
            </Alert>
          )}
        </Box>

        <TextField
          margin="dense"
          label="Tags (press Enter to add)"
          fullWidth
          variant="outlined"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          sx={{ 
            mb: 1,
            '& .MuiOutlinedInput-root': { borderRadius: 2 }
          }}
        />

        {newAlbum.tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {newAlbum.tags.map((tag, index) => (
              <Chip 
                key={index} 
                label={tag} 
                onDelete={() => handleRemoveTag(tag)} 
                size="small" 
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={creating}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleCreateAlbum} 
          variant="contained" 
          disabled={creating}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)'
            }
          }}
        >
          {creating ? <CircularProgress size={20} color="inherit" /> : 'Create Album'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateAlbumDialog;
