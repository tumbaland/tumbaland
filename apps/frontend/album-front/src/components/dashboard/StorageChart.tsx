import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress } from '@mui/material';
import { Storage as StorageIcon } from '@mui/icons-material';
import { UsageMeter, formatBytes } from '@tumbaland/frontend-core';

export interface StorageChartAlbum {
  albumId: string;
  name: string;
  totalSize: number;
}

interface StorageChartProps {
  totalStorage: number;
  averagePhotoSize: number;
  /** Top albums by storage used, largest first (see statisticsService.getTopAlbumsByStorage). */
  topAlbums?: StorageChartAlbum[];
  /**
   * The plan's storage ceiling in bytes, `-1` for unlimited, or `undefined`
   * when entitlements could not be loaded — in which case no meter is drawn.
   */
  storageLimit?: number;
  /** Bytes billed to the account, which for a group album is the owner's total, not this user's. */
  meteredStorage?: number;
  onUpgrade?: () => void;
}

const StorageChart: React.FC<StorageChartProps> = ({
  totalStorage,
  averagePhotoSize,
  topAlbums = [],
  storageLimit,
  meteredStorage,
  onUpgrade
}) => {
  // The per-album bars below are relative to the largest album, not to the
  // plan — they show distribution. The quota bar is the <UsageMeter> above.
  const largestAlbumSize = topAlbums[0]?.totalSize || 0;

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        background: 'color-mix(in srgb, var(--mui-palette-background-paper) 95%, transparent)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <StorageIcon sx={{ mr: 2, color: '#f59e0b' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Storage Usage
          </Typography>
        </Box>

        <Box sx={{ mb: 3, display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
              {formatBytes(totalStorage)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Total storage used
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
              {formatBytes(averagePhotoSize)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Average photo size
            </Typography>
          </Box>
        </Box>

        {/*
          Metered against the account's *billed* total rather than the figure
          above it. The two differ whenever albums live in a group: the
          dashboard shows what this user can see, while the quota belongs to the
          group's owner and covers everything the group holds. Showing the
          dashboard number against the plan's ceiling would quietly under-report
          how close the account is to being blocked.
        */}
        {storageLimit !== undefined && (
          <Box sx={{ mb: 3 }}>
            <UsageMeter
              label="Storage"
              used={meteredStorage ?? totalStorage}
              limit={storageLimit}
              unit="bytes"
              onUpgrade={onUpgrade}
              upgradeLabel="See plans"
            />
          </Box>
        )}

        {topAlbums.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
              Largest albums
            </Typography>
            {topAlbums.map((album) => (
              <Box key={album.albumId} sx={{ mb: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" noWrap sx={{ color: 'text.primary', maxWidth: '70%' }}>
                    {album.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                    {formatBytes(album.totalSize)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={largestAlbumSize > 0 ? (album.totalSize / largestAlbumSize) * 100 : 0}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'var(--mui-palette-divider)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      backgroundColor: '#f59e0b'
                    }
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageChart;
