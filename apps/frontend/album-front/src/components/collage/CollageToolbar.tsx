import React, { useState } from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import BorderStyleIcon from '@mui/icons-material/BorderStyle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterFramesIcon from '@mui/icons-material/FilterFrames';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import type { SaveStatus } from '../../hooks/useCollageSync';
import { CollagePeopleFaces, CollagePerson } from './CollagePeople';
import type { CollageShape } from '@tumbaland/collage-core';
import CollageAddMenu from './CollageAddMenu';

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
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddText: () => void;
  onAddSticker: (emoji: string) => void;
  onAddShape: (shape: CollageShape) => void;
  onAddDate: () => void;
  /** Chat beside the canvas. Absent where there is no chat to show (album-front on its own). */
  chat?: { open: boolean; onToggle: () => void };
  onBackgroundChange: (color: string) => void;
  onFrameColorChange: (color: string) => void;
  onFrameEnabledChange: (enabled: boolean) => void;
  onZoomChange: (zoom: number) => void;
  onExport: () => void;
  /** Only when something on the collage moves: a GIF or a video. */
  onExportVideo?: () => void;
  /** Set while a video is being recorded, which takes as long as the clip. */
  exportingVideo?: boolean;
  onPreview: () => void;
}

/**
 * Where the save stands. There is no Save button: every change is saved a
 * moment after it is made, and this says whether that has happened.
 */
const SaveIndicator: React.FC<{ status: SaveStatus; iconOnly?: boolean }> = ({ status, iconOnly }) => {
  const label = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved, retrying';
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
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
      {!iconOnly && label}
    </Box>
  );
};

/** A colour picker as a menu row: the native picker opens from the swatch. */
const ColorMenuItem: React.FC<ColorSwatchProps & { icon: React.ReactNode }> = ({ label, value, onChange, icon }) => (
  <MenuItem component="label" sx={{ minHeight: 48 }}>
    <ListItemIcon>{icon}</ListItemIcon>
    <ListItemText primary={label} />
    <Box
      component="input"
      type="color"
      aria-label={label}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      sx={{
        width: 32,
        height: 32,
        p: 0,
        ml: 2,
        border: '1px solid rgba(128,128,128,0.5)',
        borderRadius: 1,
        bgcolor: 'transparent'
      }}
    />
  </MenuItem>
);

/** Opens the stickers, shapes and date menu. */
const AddElementButton: React.FC<CollageToolbarProps & { size?: 'small' }> = ({ size, ...props }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="Add sticker or shape">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size={size} aria-label="Add sticker or shape">
          <InterestsOutlinedIcon fontSize={size} />
        </IconButton>
      </Tooltip>
      <CollageAddMenu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onAddSticker={props.onAddSticker}
        onAddShape={props.onAddShape}
        onAddDate={props.onAddDate}
      />
    </>
  );
};

const ChatToggle: React.FC<{ chat?: CollageToolbarProps['chat']; size?: 'small' }> = ({ chat, size }) =>
  chat ? (
    <Tooltip title={chat.open ? 'Hide chat' : 'Show chat'}>
      <IconButton
        onClick={chat.onToggle}
        size={size}
        aria-label={chat.open ? 'Hide chat' : 'Show chat'}
        aria-pressed={chat.open}
        color={chat.open ? 'primary' : 'default'}
      >
        {chat.open ? <ChatBubbleIcon fontSize={size} /> : <ChatBubbleOutlineIcon fontSize={size} />}
      </IconButton>
    </Tooltip>
  ) : null;

/**
 * The toolbar on a narrow screen. One row of what is used all the time, at a
 * size for fingers, with the rest behind the ⋯ menu. What can be done to a
 * selected item is on the canvas (CollageSelectionBar), not here.
 */
const CompactToolbar: React.FC<CollageToolbarProps> = (props) => {
  const { title, saveStatus, canUndo, canRedo, background, frameColor, frameEnabled } = props;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const closeThen = (action: () => void) => () => {
    setMenuAnchor(null);
    action();
  };

  return (
    <Paper square elevation={4} sx={{ zIndex: 50, pt: 'env(safe-area-inset-top)', px: 'env(safe-area-inset-left)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, minHeight: 52 }}>
        <IconButton onClick={props.onBack} aria-label="Back to collages">
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </Typography>
        <SaveIndicator status={saveStatus} iconOnly />
        <CollagePeopleFaces people={props.people ?? []} />
        <IconButton onClick={props.onUndo} disabled={!canUndo} aria-label="Undo">
          <UndoIcon />
        </IconButton>
        <IconButton onClick={props.onRedo} disabled={!canRedo} aria-label="Redo">
          <RedoIcon />
        </IconButton>
        <IconButton onClick={props.onAddText} aria-label="Add text">
          <TextFieldsIcon />
        </IconButton>
        <AddElementButton {...props} />
        <ChatToggle chat={props.chat} />
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="More">
          <MoreVertIcon />
        </IconButton>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <ColorMenuItem
          label="Background color"
          value={background}
          onChange={props.onBackgroundChange}
          icon={<FormatColorFillIcon fontSize="small" />}
        />
        <ColorMenuItem
          label="Frame color"
          value={frameColor}
          onChange={props.onFrameColorChange}
          icon={<BorderStyleIcon fontSize="small" />}
        />
        <MenuItem onClick={() => props.onFrameEnabledChange(!frameEnabled)} sx={{ minHeight: 48 }}>
          <ListItemIcon>
            <FilterFramesIcon fontSize="small" color={frameEnabled ? 'primary' : undefined} />
          </ListItemIcon>
          <ListItemText primary={frameEnabled ? 'Photo frames: on' : 'Photo frames: off'} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={closeThen(props.onPreview)} sx={{ minHeight: 48 }}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Preview" />
        </MenuItem>
        <MenuItem onClick={closeThen(props.onExport)} sx={{ minHeight: 48 }}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Download as PNG" />
        </MenuItem>
        {props.onExportVideo && (
          <MenuItem onClick={closeThen(props.onExportVideo)} disabled={props.exportingVideo} sx={{ minHeight: 48 }}>
            <ListItemIcon>
              <MovieOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={props.exportingVideo ? 'Making the video…' : 'Download as video'} />
          </MenuItem>
        )}
      </Menu>
    </Paper>
  );
};

const CollageToolbar: React.FC<CollageToolbarProps> = (props) => {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  return compact ? <CompactToolbar {...props} /> : <WideToolbar {...props} />;
};

const WideToolbar: React.FC<CollageToolbarProps> = (props) => {
  const { title, saveStatus, canUndo, canRedo, background, frameColor, frameEnabled, zoom } = props;

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
        <IconButton onClick={props.onAddText} size="small" aria-label="Add text">
          <TextFieldsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <AddElementButton {...props} size="small" />
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

      <Box sx={{ flex: 1 }} />

      <Tooltip title="Preview">
        <IconButton onClick={props.onPreview} size="small">
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <DownloadButton {...props} />
      <ChatToggle chat={props.chat} size="small" />
    </Paper>
  );
};

/** PNG straight away, or a choice of PNG and video when the collage moves. */
const DownloadButton: React.FC<CollageToolbarProps> = (props) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!props.onExportVideo) {
    return (
      <Tooltip title="Download as PNG">
        <IconButton onClick={props.onExport} size="small" aria-label="Download as PNG">
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }
  const pick = (action: () => void) => () => {
    setAnchor(null);
    action();
  };
  return (
    <>
      <Tooltip title="Download">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small" aria-label="Download">
          {props.exportingVideo ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={pick(props.onExport)}>
          <ListItemIcon>
            <ImageOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Picture (PNG)" />
        </MenuItem>
        <MenuItem onClick={pick(props.onExportVideo)} disabled={props.exportingVideo}>
          <ListItemIcon>
            <MovieOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={props.exportingVideo ? 'Making the video…' : 'Video'}
            secondary="Keeps GIFs and videos moving"
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default CollageToolbar;
