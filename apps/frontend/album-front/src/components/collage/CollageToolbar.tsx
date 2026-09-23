import React from 'react';
import { Box, CircularProgress, Divider, IconButton, MenuItem, Paper, Select, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import FilterFramesIcon from '@mui/icons-material/FilterFrames';
import type { SaveStatus } from '../../hooks/useCollageSync';
import { CollagePeopleFaces, CollagePerson } from './CollagePeople';

interface ColorSwatchProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ label, value, onChange }) => (
  <Tooltip title={label}>
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      sx={{
        width: 28,
        height: 28,
        p: 0,
        border: '1px solid rgba(128,128,128,0.5)',
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: 'transparent'
      }}
    />
  </Tooltip>
);

interface CollageToolbarProps {
  title: string;
  saveStatus: SaveStatus;
  /** Others with the collage open right now. */
  people?: CollagePerson[];
  canUndo: boolean;
  canRedo: boolean;
  background: string;
  frameColor: string;
  frameEnabled: boolean;
  zoom: number;
  hasSelection: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onBackgroundChange: (color: string) => void;
  onFrameColorChange: (color: string) => void;
  onFrameEnabledChange: (enabled: boolean) => void;
  onZoomChange: (zoom: number) => void;
  onExport: () => void;
  onPreview: () => void;
  onEditSelected: () => void;
  onDeleteSelected: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}

/**
 * Where the save stands. There is no Save button: every change is saved a
 * moment after it is made, and this says whether that has happened.
 */
const SaveIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  const label = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved, retrying';
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mr: 0.5,
        fontSize: '0.8rem',
        color: status === 'retrying' ? 'warning.main' : 'text.secondary',
        whiteSpace: 'nowrap'
      }}
    >
      {status === 'saving' ? (
        <CircularProgress size={12} thickness={5} color="inherit" />
      ) : status === 'saved' ? (
        <CloudDoneOutlinedIcon sx={{ fontSize: 16 }} />
      ) : (
        <CloudOffOutlinedIcon sx={{ fontSize: 16 }} />
      )}
      {label}
    </Box>
  );
};

const CollageToolbar: React.FC<CollageToolbarProps> = (props) => {
  const { title, saveStatus, canUndo, canRedo, background, frameColor, frameEnabled, zoom, hasSelection } = props;

  return (
    <Paper
      square
      elevation={4}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        flexWrap: 'wrap',
        zIndex: 50
      }}
    >
      <Tooltip title="Back to collages">
        <IconButton onClick={props.onBack} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          mx: 1,
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {title}
      </Typography>

      <SaveIndicator status={saveStatus} />
      <CollagePeopleFaces people={props.people ?? []} />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton onClick={props.onUndo} size="small" disabled={!canUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Shift+Z)">
        <span>
          <IconButton onClick={props.onRedo} size="small" disabled={!canRedo}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Add text">
        <IconButton onClick={props.onAddText} size="small">
          <TextFieldsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <ColorSwatch label="Background color" value={background} onChange={props.onBackgroundChange} />
      <ColorSwatch label="Frame color" value={frameColor} onChange={props.onFrameColorChange} />
      <Tooltip title={frameEnabled ? 'Photo frames: on' : 'Photo frames: off'}>
        <IconButton
          onClick={() => props.onFrameEnabledChange(!frameEnabled)}
          size="small"
          color={frameEnabled ? 'primary' : 'default'}
        >
          <FilterFramesIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Select
        value={zoom}
        onChange={(e) => props.onZoomChange(Number(e.target.value))}
        size="small"
        variant="standard"
        disableUnderline
        sx={{ fontSize: '0.85rem', minWidth: 64 }}
      >
        <MenuItem value={0}>Fit</MenuItem>
        <MenuItem value={0.5}>50%</MenuItem>
        <MenuItem value={0.75}>75%</MenuItem>
        <MenuItem value={1}>100%</MenuItem>
        <MenuItem value={1.5}>150%</MenuItem>
      </Select>

      {hasSelection && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Edit item">
            <IconButton onClick={props.onEditSelected} size="small">
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bring forward">
            <IconButton onClick={props.onBringForward} size="small">
              <FlipToFrontIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Send backward">
            <IconButton onClick={props.onSendBackward} size="small">
              <FlipToBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete item (Del)">
            <IconButton onClick={props.onDeleteSelected} size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

      <Box sx={{ flex: 1 }} />

      <Tooltip title="Preview">
        <IconButton onClick={props.onPreview} size="small">
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Download as PNG">
        <IconButton onClick={props.onExport} size="small">
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

export default CollageToolbar;
