import React from 'react';
import { Box, Card, CardContent, Typography, alpha } from '@mui/material';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}

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
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 2
          }}>
          <Box 
            sx={{ 
              color: color, 
              mr: 2,
              p: 1,
              borderRadius: 2,
              bgcolor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: "text.secondary"
            }}>
            {title}
          </Typography>
        </Box>
        <Typography
          variant="h4"
          component="p"
          gutterBottom
          sx={{
            fontWeight: "bold",
            color: 'text.primary'
          }}>
          {value}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontSize: '0.875rem'
          }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default StatCard;
