import React from 'react';
import { Box, Chip } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import { Day } from '../services/types';

/** One entry rendered inside a day card. */
export const EntryChip: React.FC<{ entry: Day['entries'][number] }> = ({ entry }) => {
  const type = entry.type;
  const value =
    type?.valueType === 'number'
      ? entry.hours !== undefined && entry.hours !== null
        ? `${entry.hours}h`
        : undefined
      : entry.description || undefined;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: type?.color || '#9e9e9e',
            ml: '6px !important'
          }}
        />
      }
      label={
        <Box component="span">
          <span>
            <strong>{type?.name || 'Unknown'}</strong>
            {value ? ` · ${value}` : ''}
          </span>
          {entry.location && (
            <>
              <PlaceIcon
                sx={{
                  fontSize: 13,
                  ml: 0.5,
                  mr: 0.25,
                  color: 'text.disabled',
                  verticalAlign: 'text-bottom'
                }}
              />
              <span>{entry.location.label}</span>
            </>
          )}
        </Box>
      }
      sx={{
        borderColor: 'divider',
        bgcolor: 'transparent',
        maxWidth: '100%',
        // A chip's label never wraps by default, so a long description or place
        // name used to push the whole journal wider than a phone screen.
        height: 'auto',
        '& .MuiChip-label': {
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          py: 0.25
        }
      }}
    />
  );
};

export default EntryChip;
