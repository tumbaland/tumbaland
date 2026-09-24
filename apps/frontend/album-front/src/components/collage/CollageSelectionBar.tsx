import React from 'react';
import { Box, Button, Divider } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

interface CollageSelectionBarProps {
  kind: 'photo' | 'text';
  onEdit: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDelete: () => void;
}

const buttonSx = {
  color: 'inherit',
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: 999,
  px: 1.5,
  minHeight: 40,
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }
} as const;

/**
 * What can be done to the selected item, floating over the bottom of the
 * canvas: next to the work rather than in the toolbar, where it used to push
 * the other buttons along whenever something was selected, and labelled,
 * since a touch screen has no hovering over an icon to learn what it does.
 */
const CollageSelectionBar: React.FC<CollageSelectionBarProps> = ({
  kind,
  onEdit,
  onBringForward,
  onSendBackward,
  onDelete
}) => (
  <Box
    role="toolbar"
    aria-label={kind === 'photo' ? 'Selected photo' : 'Selected text'}
    // Its own clicks must not reach the canvas, which would clear the selection.
    onPointerDown={(e) => e.stopPropagation()}
    sx={{
      position: 'absolute',
      left: '50%',
      bottom: 16,
      transform: 'translateX(-50%)',
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 0.25,
      p: 0.5,
      maxWidth: 'calc(100% - 24px)',
      overflowX: 'auto',
      borderRadius: 999,
      color: '#fff',
      bgcolor: 'rgba(28,28,30,0.86)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)'
    }}
  >
    <Button
      size="small"
      startIcon={<TuneIcon />}
      onClick={onEdit}
      aria-label={kind === 'photo' ? 'Edit photo' : 'Edit text'}
      sx={buttonSx}
    >
      Edit
    </Button>
    <Button
      size="small"
      startIcon={<FlipToFrontIcon />}
      onClick={onBringForward}
      aria-label="Bring forward"
      sx={buttonSx}
    >
      Forward
    </Button>
    <Button
      size="small"
      startIcon={<FlipToBackIcon />}
      onClick={onSendBackward}
      aria-label="Send backward"
      sx={buttonSx}
    >
      Backward
    </Button>
    <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.16)', my: 0.75 }} />
    <Button
      size="small"
      startIcon={<DeleteOutlinedIcon />}
      onClick={onDelete}
      aria-label={kind === 'photo' ? 'Delete photo' : 'Delete text'}
      sx={{ ...buttonSx, color: '#fca5a5' }}
    >
      Delete
    </Button>
  </Box>
);

export default CollageSelectionBar;
