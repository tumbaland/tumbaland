import React from 'react';
import { useNavigate } from 'react-router';
import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import {
  PhotoLibrary as PhotoLibraryIcon,
  Photo as PhotoIcon,
  Storage as StorageIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { brand, ink, moduleAccent } from '@tumbaland/frontend-core';
import { formatBytes } from '../../utils/formatBytes';
import { appPath } from '../../appBase';

interface StatisticsOverviewData {
  totalAlbums: number;
  totalPhotos: number;
  totalStorage: number;
  averagePhotoSize: number;
}

interface StatisticsOverviewProps {
  data: StatisticsOverviewData;
}

/**
 * The four headline figures. Two by two on a phone: one card per row made the
 * figures alone fill most of the first screen.
 *
 * Only Albums carries a `to`. It is the one figure with an obvious page behind
 * it — photos live inside albums rather than on a page of their own, and the
 * two storage figures describe the library rather than name a place in it.
 * Giving the other three a destination would mean inventing one.
 */
const StatisticsOverview: React.FC<StatisticsOverviewProps> = ({ data }) => {
  const navigate = useNavigate();

  const stats = [
    {
      title: 'Total Albums',
      value: data.totalAlbums.toLocaleString(),
      Icon: PhotoLibraryIcon,
      color: brand.violet,
      to: appPath('/albums')
    },
    { title: 'Total Photos', value: data.totalPhotos.toLocaleString(), Icon: PhotoIcon, color: moduleAccent.money },
    { title: 'Storage Used', value: formatBytes(data.totalStorage), Icon: StorageIcon, color: '#b45309' },
    { title: 'Avg Photo Size', value: formatBytes(data.averagePhotoSize), Icon: ImageIcon, color: moduleAccent.journal }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))'
        },
        gap: { xs: 1.5, sm: 2, md: 3 },
        mb: { xs: 2, sm: 4 }
      }}
    >
      {stats.map(({ title, value, Icon, color, to }) => {
        const body = (
          <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 2 } }}>
              <Icon sx={{ fontSize: { xs: 28, sm: 40 }, color, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ fontWeight: 700, color: ink.strong, fontSize: { xs: '1.2rem', sm: '2rem' }, lineHeight: 1.2 }}
                >
                  {value}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ color: ink.muted, fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  {title}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        );

        return (
          <Card
            key={title}
            sx={{
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              background: 'color-mix(in srgb, var(--mui-palette-background-paper) 95%, transparent)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'transform 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
              }
            }}
          >
            {/* CardActionArea rather than an onClick on the Card: it is a real
                button, so the whole tile is keyboard-reachable and announces
                itself, and it brings the ripple and focus ring with it. */}
            {to ? (
              <CardActionArea onClick={() => navigate(to)} aria-label={`${title}: ${value}. View albums`}>
                {body}
              </CardActionArea>
            ) : (
              body
            )}
          </Card>
        );
      })}
    </Box>
  );
};

export default StatisticsOverview;
