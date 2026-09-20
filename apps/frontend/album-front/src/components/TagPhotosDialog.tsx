import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { logger } from '@tumbaland/frontend-core';
import { Photo, TagCount } from '../types';
import TagInput, { normalizeTagList } from './TagInput';
import { gradient } from '@tumbaland/frontend-core';

/** What to do with a tag that only some of the selected photos carry. */
type PartialAction = 'keep' | 'add' | 'remove';

interface TagPhotosDialogProps {
  open: boolean;
  photos: Photo[];
  suggestions: TagCount[];
  onClose: () => void;
  onApply: (photoIds: string[], changes: { add: string[]; remove: string[] }) => Promise<unknown>;
}

const splitTags = (photos: Photo[]) => {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    for (const tag of new Set(photo.tags || [])) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const common: string[] = [];
  const partial: { tag: string; count: number }[] = [];
  for (const [tag, count] of counts) {
    if (count === photos.length) common.push(tag);
    else partial.push({ tag, count });
  }
  return { common: common.sort(), partial: partial.sort((a, b) => b.count - a.count) };
};

/**
 * Tag one photo or a whole selection.
 *
 * The editable field holds the tags every selected photo already carries, so
 * editing it reads the same whether one or fifty photos are selected: what you
 * leave in the field is what they all end up with. Tags only some of them carry
 * are listed separately, untouched unless you explicitly add or remove them —
 * a blanket overwrite would silently strip tags the user never saw.
 */
const TagPhotosDialog: React.FC<TagPhotosDialogProps> = ({ open, photos, suggestions, onClose, onApply }) => {
  const { common, partial } = useMemo(() => splitTags(photos), [photos]);
  const [tags, setTags] = useState<string[]>(common);
  const [partialActions, setPartialActions] = useState<Record<string, PartialAction>>({});
  const [saving, setSaving] = useState(false);

  // Reset whenever the dialog opens on a different selection.
  useEffect(() => {
    if (open) {
      setTags(common);
      setPartialActions({});
    }
  }, [open, photos]);

  const multiple = photos.length > 1;

  const cyclePartial = (tag: string) => {
    setPartialActions((prev) => {
      const current = prev[tag] ?? 'keep';
      const next: PartialAction = current === 'keep' ? 'add' : current === 'add' ? 'remove' : 'keep';
      return { ...prev, [tag]: next };
    });
  };

  const add = useMemo(() => {
    const fromField = tags.filter((tag) => !common.includes(tag));
    const fromPartial = partial.filter((p) => partialActions[p.tag] === 'add').map((p) => p.tag);
    return normalizeTagList([...fromField, ...fromPartial]);
  }, [tags, common, partial, partialActions]);

  const remove = useMemo(() => {
    const fromField = common.filter((tag) => !tags.includes(tag));
    const fromPartial = partial.filter((p) => partialActions[p.tag] === 'remove').map((p) => p.tag);
    return normalizeTagList([...fromField, ...fromPartial]);
  }, [tags, common, partial, partialActions]);

  const hasChanges = add.length > 0 || remove.length > 0;

  const handleApply = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onApply(
        photos.map((p) => p._id),
        { add, remove }
      );
      onClose();
    } catch (error) {
      logger.error('Failed to update tags', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)'
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 3, px: 3 }}>
        <Box sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
          {multiple ? `Tag ${photos.length} photos` : 'Edit tags'}
        </Box>
        <IconButton onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, px: 3 }}>
        <Box sx={{ mt: 1 }}>
          <TagInput
            value={tags}
            onChange={setTags}
            suggestions={suggestions}
            disabled={saving}
            autoFocus
            label={multiple ? 'Tags on all selected photos' : 'Tags'}
            helperText="Press Enter or comma to add. Pick from suggestions to reuse an existing tag."
          />
        </Box>

        {partial.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
              On some photos — click to apply to all, again to remove from all
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {partial.map(({ tag, count }) => {
                const action = partialActions[tag] ?? 'keep';
                return (
                  <Chip
                    key={tag}
                    label={`${tag} (${count}/${photos.length})`}
                    size="small"
                    disabled={saving}
                    onClick={() => cyclePartial(tag)}
                    icon={
                      action === 'add' ? (
                        <AddIcon fontSize="small" />
                      ) : action === 'remove' ? (
                        <RemoveIcon fontSize="small" />
                      ) : undefined
                    }
                    color={action === 'add' ? 'primary' : action === 'remove' ? 'error' : 'default'}
                    variant={action === 'keep' ? 'outlined' : 'filled'}
                    sx={{
                      borderRadius: 1.5,
                      textDecoration: action === 'remove' ? 'line-through' : 'none'
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: 'rgba(0,0,0,0.12)',
            color: 'text.primary'
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={saving || !hasChanges}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            background: gradient.brand,
            boxShadow: '0 4px 12px rgba(168, 45, 190, 0.3)'
          }}
        >
          {saving ? 'Saving...' : 'Save tags'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagPhotosDialog;
