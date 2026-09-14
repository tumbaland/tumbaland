import React from 'react';
import { Box, Card, CardContent, Typography, alpha } from '@mui/material';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}

/**
 * One figure with its label and a line of context.
 *
 * Compact on a phone, where two sit side by side: a smaller icon, title and
 * number, so each card carries the same information in about half the height
 * of the one-per-row version.
 */
const StatCard: React.FC<StatCardProps> = ({ icon, title, value, subtitle, color }) => {
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 20px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3)
        }
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, mb: { xs: 0.75, sm: 1.5 } }}>
          <Box
            sx={{
              color: color,
              p: { xs: 0.5, sm: 1 },
              borderRadius: 2,
              bgcolor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              '& svg': { fontSize: { xs: 18, sm: 24 } }
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{
              minWidth: 0,
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: { xs: '0.8rem', sm: '1rem' }
            }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          variant="h4"
          component="p"
          sx={{
            fontWeight: 'bold',
            color: 'text.primary',
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
            lineHeight: 1.2,
            mb: 0.25
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: { xs: '0.72rem', sm: '0.875rem' },
            lineHeight: 1.35
          }}
        >
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default StatCard;
