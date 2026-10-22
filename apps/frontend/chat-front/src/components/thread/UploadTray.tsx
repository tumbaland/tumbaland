import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { ink, surface } from '@tumbaland/frontend-core';
import type { PendingUpload } from '../../types';
import { isDocumentType } from '../../services/documents';
import { firstFrameSrc } from './MediaGrid';
import { isVisualType } from '../../services/voice';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import PhotoAlbumOutlinedIcon from '@mui/icons-material/PhotoAlbumOutlined';
import { brand } from '@tumbaland/frontend-core';

/**
 * Whether one photo on the tray goes to the album: filled when it does,
 * outlined when it stays in chat only. A photo left out is also dimmed, so a
 * tray of them reads at a glance.
 */
function AlbumSwitch({
  name,
  album,
  going,
  onToggle
}: {
  name: string;
  album: string;
  going: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {!going && (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
      )}
      <Tooltip title={going ? `Goes to ${album}. Tap to keep it out` : `Stays in chat only. Tap to add to ${album}`}>
        <IconButton
          size="small"
          aria-label={`Add ${name} to ${album}`}
          aria-pressed={going}
          onClick={onToggle}
          sx={{
            position: 'absolute',
            bottom: 2,
            left: 2,
            p: 0.25,
            color: '#fff',
            bgcolor: going ? brand.pinkInk : 'rgba(0,0,0,0.55)',
            '&:hover': { bgcolor: going ? brand.pinkInk : 'rgba(0,0,0,0.75)' }
          }}
        >
          {going ? <PhotoAlbumIcon sx={{ fontSize: 14 }} /> : <PhotoAlbumOutlinedIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
    </>
  );
}

export interface UploadTrayProps {
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
  /**
   * The chat's album, when photos are going to one: each photo gets a switch
   * for whether it goes too. Absent when nothing is being saved.
   */
  album?: { name: string; skipped: ReadonlySet<string>; onToggle: (id: string) => void };
}

/**
 * The strip of thumbnails above the composer, while files are on their way.
 *
 * Previews come from a local object URL, so they appear the instant a file is
 * picked rather than after a round trip. Progress is per file: one slow clip
 * among four photos should not look like everything has stalled.
 */
export function UploadTray({ uploads, onRemove, album }: UploadTrayProps) {
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
            {isDocumentType(upload.mimetype) ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  height: '100%',
                  px: 0.5,
                  color: ink.muted
                }}
              >
                <InsertDriveFileOutlinedIcon />
                <Box sx={{ width: '100%', fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>
                  <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {upload.name}
                  </Box>
                </Box>
              </Box>
            ) : upload.mimetype.startsWith('video/') ? (
              <Box
                component="video"
                src={firstFrameSrc(upload.previewUrl)}
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

            {album && isVisualType(upload.mimetype) && (
              <AlbumSwitch
                name={upload.name}
                album={album.name}
                going={!album.skipped.has(upload.id)}
                onToggle={() => album.onToggle(upload.id)}
              />
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
