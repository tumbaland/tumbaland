import React, { useState } from 'react';
import { Box, Button, Chip, Collapse, Typography } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { TagCount, TagMatch } from '../types';

interface PhotoTagFilterProps {
  tags: TagCount[];
  selected: string[];
  match: TagMatch;
  onChange: (tags: string[]) => void;
  onMatchChange: (match: TagMatch) => void;
}

/** How many tags to show before the row collapses behind "Show all". */
const COLLAPSED_LIMIT = 12;

/**
 * Filter chips over an album's tag vocabulary. Clicking toggles a tag; with
 * more than one selected the match mode decides whether photos must carry all
 * of them or any.
 */
const PhotoTagFilter: React.FC<PhotoTagFilterProps> = ({
  tags,
  selected,
  match,
  onChange,
  onMatchChange
}) => {
  const [expanded, setExpanded] = useState(false);

  if (tags.length === 0) return null;

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  };

  const visible = expanded ? tags : tags.slice(0, COLLAPSED_LIMIT);
  const hidden = tags.length - visible.length;

  return (
    <Box sx={{ mb: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <LocalOfferIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Filter by tag
        </Typography>
        {selected.length > 1 && (
          <Button
            size="small"
            onClick={() => onMatchChange(match === 'all' ? 'any' : 'all')}
            sx={{ textTransform: 'none', minWidth: 0 }}
          >
            {match === 'all' ? 'Match all' : 'Match any'}
          </Button>
        )}
        {selected.length > 0 && (
          <Button size="small" onClick={() => onChange([])} sx={{ textTransform: 'none', minWidth: 0 }}>
            Clear
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {visible.map(({ tag, count }) => {
          const active = selected.includes(tag);
          return (
            <Chip
              key={tag}
              label={`${tag} (${count})`}
              size="small"
              onClick={() => toggle(tag)}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              sx={{ borderRadius: 1.5 }}
            />
          );
        })}
        {hidden > 0 && (
          <Chip
            label={`+${hidden} more`}
            size="small"
            variant="outlined"
            onClick={() => setExpanded(true)}
            sx={{ borderRadius: 1.5, borderStyle: 'dashed' }}
          />
        )}
      </Box>

      <Collapse in={expanded && tags.length > COLLAPSED_LIMIT}>
        <Button size="small" onClick={() => setExpanded(false)} sx={{ mt: 1, textTransform: 'none' }}>
          Show fewer
        </Button>
      </Collapse>
    </Box>
  );
};

export default PhotoTagFilter;
