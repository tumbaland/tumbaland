import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReplyIcon from '@mui/icons-material/Reply';
import { ink, surface } from '@tumbaland/frontend-core';

/** Above the box while a sent message is being edited. */
export function EditingBanner({ accent, onCancel }: { accent: string; onCancel?: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, pt: 0.5 }}>
      <EditOutlinedIcon sx={{ fontSize: 18, color: accent }} />
      <Typography variant="caption" sx={{ flex: 1, color: ink.muted, fontWeight: 600 }}>
        Editing message
      </Typography>
      <IconButton size="small" aria-label="Cancel edit" onClick={onCancel} sx={{ color: ink.muted }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/** Above the box while the next send answers a message. */
export function ReplyingBanner({
  replying,
  accent,
  onCancel
}: {
  replying: { id: string; name: string; text: string };
  accent: string;
  onCancel?: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 1, pt: 0.5 }}>
      <ReplyIcon sx={{ fontSize: 18, color: accent }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', color: ink.muted, fontWeight: 600, lineHeight: 1.3 }}>
          Replying to {replying.name || 'a message'}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: ink.muted, lineHeight: 1.3 }}>
          {replying.text}
        </Typography>
      </Box>
      <IconButton size="small" aria-label="Cancel reply" onClick={onCancel} sx={{ color: ink.muted }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/**
 * The emoji used most recently, one tap away above the box. Taking the
 * mouse-down keeps the focus, and on a phone the keyboard, in the message box.
 */
export function RecentEmojiRow({ emoji: recent, onPick }: { emoji: string[]; onPick: (emoji: string) => void }) {
  return (
    <Box
      role="group"
      aria-label="Recent emoji"
      sx={{
        display: 'flex',
        gap: 0.25,
        px: 1,
        pt: 0.5,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' }
      }}
    >
      {recent.map((emoji) => (
        <Box
          key={emoji}
          component="button"
          type="button"
          aria-label={`Add ${emoji}`}
          // Keeps the focus, and on a phone the keyboard, in the message box.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(emoji)}
          tabIndex={-1}
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: '50%',
            background: 'none',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            p: 0,
            transition: 'transform .12s ease, background-color .12s ease',
            '&:hover': { backgroundColor: surface.sunken, transform: 'scale(1.12)' },
            '&:active': { transform: 'scale(0.92)' }
          }}
        >
          {emoji}
        </Box>
      ))}
    </Box>
  );
}
