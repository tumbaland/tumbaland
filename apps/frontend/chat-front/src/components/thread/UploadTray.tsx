import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { ink, surface } from '@tumbaland/frontend-core';
import type { PendingUpload } from '../../types';

export interface UploadTrayProps {
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
}

/**
 * The strip of thumbnails above the composer, while files are on their way.
 *
 * Previews come from a local object URL, so they appear the instant a file is
 * picked rather than after a round trip. Progress is per file: one slow clip
 * among four photos should not look like everything has stalled.
 */
export function UploadTray({ uploads, onRemove }: UploadTrayProps) {
  return (
    <Box
      sx={{ display: 'flex', gap: 1, px: 1, pt: 1, overflowX: 'auto' }}
      role="list"
      aria-label="Attachments to send"
    >
      {uploads.map((upload) => {
        const failed = upload.status === 'failed';
        const busy = upload.status === 'preparing' || upload.status === 'uploading';

        return (
          <Box
            key={upload.id}
            role="listitem"
            sx={{
              position: 'relative',
              flexShrink: 0,
              width: 72,
              height: 72,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: surface.sunken,
              border: failed ? '1px solid' : 'none',
              borderColor: 'error.main'
            }}
          >
            {upload.mimetype.startsWith('video/') ? (
              <Box
                component="video"
                src={upload.previewUrl}
                muted
                playsInline
                preload="metadata"
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box
                component="img"
                src={upload.previewUrl}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {busy && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)' }}>
                <LinearProgress
                  // Indeterminate while a file is still being resized or a
                  // poster captured: there is no byte count to report yet.
                  variant={upload.status === 'uploading' ? 'determinate' : 'indeterminate'}
                  value={upload.progress}
                  sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
                />
              </Box>
            )}

            {failed && (
              <Tooltip title={upload.error ?? 'Upload failed'}>
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <ErrorOutlineIcon sx={{ color: 'error.main' }} />
                </Box>
              </Tooltip>
            )}

            <IconButton
              size="small"
              aria-label={`Remove ${upload.name}`}
              onClick={() => onRemove(upload.id)}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                p: 0.25,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' }
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      })}

      {uploads.some((upload) => upload.status === 'failed') && (
        <Box sx={{ alignSelf: 'center', fontSize: 12, color: ink.muted, pl: 0.5 }}>
          Failed uploads are not sent.
        </Box>
      )}
    </Box>
  );
}
