import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { formatBytes, ink, surface } from '@tumbaland/frontend-core';
import { extensionLabel } from '../../services/documents';
import type { Attachment } from '../../types';
import { downloadAttachment } from './Lightbox';

export interface DocumentCardProps {
  attachment: Attachment;
}

/**
 * A document in a bubble: its name, type and size, and a tap to save it.
 *
 * Documents have no preview and no lightbox. Saving goes through the same
 * blob download the lightbox uses, so the file keeps its own name and the app
 * is not navigated away from a call.
 */
export function DocumentCard({ attachment }: DocumentCardProps) {
  const name = attachment.name || 'Document';
  const unavailable = !attachment.url;

  return (
    <Box
      component="button"
      type="button"
      disabled={unavailable}
      onClick={() => void downloadAttachment(attachment)}
      aria-label={`Download ${name}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        width: 'min(280px, 100%)',
        mb: 0.5,
        p: 1,
        border: 'none',
        borderRadius: 2,
        bgcolor: surface.sunken,
        color: 'inherit',
        textAlign: 'left',
        font: 'inherit',
        cursor: unavailable ? 'default' : 'pointer',
        opacity: unavailable ? 0.6 : 1
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <InsertDriveFileOutlinedIcon sx={{ fontSize: 40, color: ink.muted }} />
        <Box
          component="span"
          sx={{ position: 'absolute', bottom: 6, fontSize: 8, fontWeight: 700, color: ink.muted, lineHeight: 1 }}
        >
          {extensionLabel(attachment.name, attachment.mimetype)}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ color: ink.muted }}>
          {unavailable ? 'Not available' : formatBytes(attachment.sizeBytes)}
        </Typography>
      </Box>
    </Box>
  );
}
