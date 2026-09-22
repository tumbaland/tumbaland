import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import { ink, surface } from '@tumbaland/frontend-core';
import type { Appearance } from '../../types';
import { CHAT_THEMES, type ChatTheme } from './themes';

export interface ThemePickerProps {
  open: boolean;
  onClose: () => void;
  appearance: Appearance;
  onChange: (change: { theme?: string; backgroundFileId?: string | null }) => Promise<void>;
}

/** A theme as a tiny thread: its background, one of their bubbles, one of yours. */
function Swatch({ theme }: { theme: ChatTheme }) {
  return (
    <Box
      aria-hidden
      sx={{
        height: 64,
        borderRadius: 2,
        background: theme.background,
        border: `1px solid ${surface.sunken}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 0.5,
        px: 1
      }}
    >
      <Box sx={{ alignSelf: 'flex-start', width: '55%', height: 12, borderRadius: 6, bgcolor: surface.paper }} />
      <Box sx={{ alignSelf: 'flex-end', width: '45%', height: 12, borderRadius: 6, bgcolor: theme.bubble }} />
    </Box>
  );
}

/**
 * The conversation's theme, shared by everyone in it. The background photo is
 * chosen from the photo viewer ("Use as background"), and removed here.
 */
export function ThemePicker({ open, onClose, appearance, onChange }: ThemePickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: { theme?: string; backgroundFileId?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      await onChange(next);
    } catch {
      setError('Could not change that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>Theme</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: ink.muted, mb: 2 }}>
          You both see the theme you pick.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          role="radiogroup"
          aria-label="Themes"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5 }}
        >
          {CHAT_THEMES.map((theme) => {
            const selected = appearance.theme === theme.id;
            return (
              <Box
                key={theme.id}
                component="button"
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={theme.name}
                disabled={busy}
                onClick={() => !selected && void change({ theme: theme.id })}
                sx={{
                  p: 0.5,
                  border: '2px solid',
                  borderColor: selected ? theme.bubble : 'transparent',
                  borderRadius: 2.5,
                  background: 'none',
                  cursor: busy ? 'default' : 'pointer',
                  font: 'inherit',
                  textAlign: 'center',
                  '&:focus-visible': { outline: `2px solid ${theme.bubble}`, outlineOffset: 2 }
                }}
              >
                <Swatch theme={theme} />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    mt: 0.5,
                    fontSize: 13,
                    fontWeight: selected ? 700 : 500,
                    color: ink.body
                  }}
                >
                  {selected && <CheckIcon sx={{ fontSize: 14, color: theme.bubble }} />}
                  {theme.name}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Background photo
        </Typography>
        {appearance.backgroundFileId ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {appearance.backgroundUrl && (
              <Box
                component="img"
                src={appearance.backgroundUrl}
                alt=""
                sx={{ width: 56, height: 56, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <Button disabled={busy} onClick={() => void change({ backgroundFileId: null })}>
              Remove background
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: ink.muted }}>
            Open any photo in this chat and choose Use as background.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
