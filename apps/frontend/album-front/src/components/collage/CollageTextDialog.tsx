import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Slider,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import {
  COLLAGE_SHAPES,
  CollageShape,
  CollageTextItem,
  DEFAULT_FONT,
  DEFAULT_TEXT,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  TextAlign
} from './collageDoc';
import {
  COLLAGE_FONTS,
  ensureCollageFonts,
  fontById,
  labelRadius,
  SHAPE_LABELS,
  SHAPE_PATHS,
  STICKERS,
  textCss
} from './collageElements';

/** What Apply writes back: the item's look and content, never its place. */
export type CollageTextPatch = Partial<Omit<CollageTextItem, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>>;

interface CollageTextDialogProps {
  open: boolean;
  text: CollageTextItem | null;
  onClose: () => void;
  onSave: (patch: CollageTextPatch) => void;
  onDelete: () => void;
}

/** Colours one tap away; the square at the end opens the full picker. */
export const SWATCHES = ['#ffffff', '#111827', '#e91e63', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#8b5cf6'];

const ColorRow: React.FC<{ label: string; value: string; onChange: (color: string) => void }> = ({
  label,
  value,
  onChange
}) => (
  <Box role="group" aria-label={label} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
    {SWATCHES.map((swatch) => (
      <ButtonBase
        key={swatch}
        aria-label={`${label} ${swatch}`}
        aria-pressed={value.toLowerCase() === swatch}
        onClick={() => onChange(swatch)}
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: swatch,
          border: '1px solid rgba(128,128,128,0.5)',
          outline: value.toLowerCase() === swatch ? '2px solid' : 'none',
          outlineColor: 'primary.main',
          outlineOffset: 2
        }}
      />
    ))}
    <Box
      component="input"
      type="color"
      aria-label={`${label}, any colour`}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      sx={{
        width: 36,
        height: 30,
        p: 0,
        border: '1px solid rgba(128,128,128,0.5)',
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: 'transparent'
      }}
    />
  </Box>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mt: 2 }}>
    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

/** An optional colour: a switch, and the colours once it is on. */
const OptionalColor: React.FC<{
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (color: string | undefined) => void;
}> = ({ label, value, fallback, onChange }) => (
  <Box sx={{ mt: 1 }}>
    <FormControlLabel
      control={<Switch checked={Boolean(value)} onChange={(_, on) => onChange(on ? fallback : undefined)} />}
      label={label}
    />
    {value && <ColorRow label={label} value={value} onChange={onChange} />}
  </Box>
);

/**
 * Edits one item on the layer above the photos: a text's words and look, a
 * sticker's emoji, or a shape's kind and colours.
 */
const CollageTextDialog: React.FC<CollageTextDialogProps> = ({ open, text, onClose, onSave, onDelete }) => {
  // A phone: the whole screen, with room for the keyboard.
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const kind = text?.kind ?? 'text';
  const [draft, setDraft] = useState<CollageTextPatch>({});

  useEffect(() => {
    if (text) {
      const { id: _id, x: _x, y: _y, width: _w, height: _h, rotation: _r, ...look } = text;
      setDraft(look);
    }
  }, [text]);

  useEffect(() => {
    if (open) ensureCollageFonts();
  }, [open]);

  const set = (patch: CollageTextPatch) => setDraft((current) => ({ ...current, ...patch }));
  const value = draft.text ?? '';
  const fontSize = draft.fontSize ?? DEFAULT_TEXT_SIZE;
  const color = draft.color ?? DEFAULT_TEXT_COLOR;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  // Capped, so a poster-sized heading still fits the dialog.
  const preview: CollageTextItem = {
    ...draft,
    id: 'preview',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    text: value,
    color,
    fontSize: Math.min(fontSize, 40)
  };

  const title = kind === 'shape' ? 'Edit shape' : kind === 'sticker' ? 'Edit sticker' : 'Edit text';

  return (
    <Dialog open={open} fullScreen={fullScreen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {kind === 'text' && (
          <>
            <TextField
              autoFocus
              label="Text"
              fullWidth
              multiline
              minRows={2}
              margin="dense"
              value={value}
              onChange={(e) => set({ text: e.target.value })}
              // Fresh from "Add text": typing replaces the placeholder.
              onFocus={(e) => value === DEFAULT_TEXT && e.target.select()}
            />

            <Section title="Font">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {COLLAGE_FONTS.map((font) => {
                  const chosen = (draft.fontFamily ?? DEFAULT_FONT) === font.id;
                  return (
                    <Button
                      key={font.id}
                      size="small"
                      variant={chosen ? 'contained' : 'outlined'}
                      aria-pressed={chosen}
                      onClick={() => set({ fontFamily: font.id })}
                      sx={{ textTransform: 'none', fontFamily: fontById(font.id).family, fontSize: 16, minWidth: 0 }}
                    >
                      {font.label}
                    </Button>
                  );
                })}
              </Box>
            </Section>

            <Section title={`Size: ${fontSize}px`}>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={fontSize}
                  onChange={(_, v) => set({ fontSize: v as number })}
                  min={12}
                  max={160}
                  valueLabelDisplay="auto"
                  aria-label="Size"
                />
              </Box>
            </Section>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
              <ToggleButtonGroup size="small" aria-label="Style">
                <ToggleButton
                  value="bold"
                  aria-label="Bold"
                  selected={draft.bold !== false}
                  onChange={() => set({ bold: draft.bold === false })}
                >
                  <FormatBoldIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton
                  value="italic"
                  aria-label="Italic"
                  selected={draft.italic === true}
                  onChange={() => set({ italic: !draft.italic })}
                >
                  <FormatItalicIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                size="small"
                exclusive
                aria-label="Alignment"
                value={draft.align ?? 'center'}
                onChange={(_, align: TextAlign | null) => align && set({ align })}
              >
                <ToggleButton value="left" aria-label="Align left">
                  <FormatAlignLeftIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="center" aria-label="Align centre">
                  <FormatAlignCenterIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="right" aria-label="Align right">
                  <FormatAlignRightIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Section title="Color">
              <ColorRow label="Text color" value={color} onChange={(c) => set({ color: c })} />
            </Section>
            <OptionalColor
              label="Label behind the text"
              value={draft.background}
              fallback="#ffffff"
              onChange={(background) => set({ background })}
            />
            <OptionalColor
              label="Outline"
              value={draft.outline}
              fallback="#ffffff"
              onChange={(outline) => set({ outline })}
            />
            <FormControlLabel
              control={<Switch checked={draft.shadow === true} onChange={(_, on) => set({ shadow: on })} />}
              label="Shadow"
            />

            <Box
              aria-label="Preview"
              sx={{
                mt: 2,
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(128,128,128,0.15)',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'block',
                  maxWidth: '100%',
                  whiteSpace: 'pre-line',
                  overflowWrap: 'break-word',
                  py: 0.5,
                  bgcolor: draft.background,
                  borderRadius: `${labelRadius(preview)}px`,
                  ...textCss(preview)
                }}
              >
                {value || 'Preview'}
              </Box>
            </Box>
          </>
        )}

        {kind === 'sticker' && (
          <Section title="Sticker">
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5 }}>
              {STICKERS.map((emoji) => (
                <ButtonBase
                  key={emoji}
                  aria-label={`Sticker ${emoji}`}
                  aria-pressed={value === emoji}
                  onClick={() => set({ text: emoji })}
                  sx={{
                    fontSize: 28,
                    aspectRatio: '1',
                    borderRadius: 1,
                    bgcolor: value === emoji ? 'action.selected' : undefined
                  }}
                >
                  {emoji}
                </ButtonBase>
              ))}
            </Box>
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Switch checked={draft.shadow === true} onChange={(_, on) => set({ shadow: on })} />}
              label="Shadow"
            />
          </Section>
        )}

        {kind === 'shape' && (
          <>
            <Section title="Shape">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {COLLAGE_SHAPES.map((shape: CollageShape) => (
                  <ButtonBase
                    key={shape}
                    aria-label={SHAPE_LABELS[shape]}
                    aria-pressed={draft.shape === shape}
                    onClick={() => set({ shape })}
                    sx={{
                      width: 48,
                      height: 48,
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: draft.shape === shape ? 'primary.main' : 'divider'
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
                      <path d={SHAPE_PATHS[shape]} fill={color} />
                    </svg>
                  </ButtonBase>
                ))}
              </Box>
            </Section>
            <Section title="Fill">
              <ColorRow label="Fill color" value={color} onChange={(c) => set({ color: c })} />
            </Section>
            <OptionalColor
              label="Outline"
              value={draft.outline}
              fallback="#ffffff"
              onChange={(outline) => set({ outline })}
            />
            <FormControlLabel
              control={<Switch checked={draft.shadow === true} onChange={(_, on) => set({ shadow: on })} />}
              label="Shadow"
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={() => {
            onDelete();
            onClose();
          }}
          color="error"
        >
          Delete
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollageTextDialog;
