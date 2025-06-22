import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Paper } from '@mui/material';
import { TrendingUp, AccountBalance, Assessment, Timeline } from '@mui/icons-material';

const Dashboard: React.FC = () => {
  // Mock data for demonstration
  const portfolioStats = {
    totalValue: 125000,
    todayChange: 2150,
    todayChangePercent: 1.75,
    totalReturn: 25000,
    totalReturnPercent: 25.0
  };

  const StatCard = ({ icon, title, value, subtitle, color }: any) => (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Box sx={{ color: color, mr: 1 }}>
            {icon}
          </Box>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="p" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Portfolio Dashboard
      </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <StatCard
            icon={<AccountBalance />}
            title="Total Portfolio Value"
            value={`$${portfolioStats.totalValue.toLocaleString()}`}
            subtitle="Current market value"
            color="primary.main"
          />
          <StatCard
            icon={<TrendingUp />}
            title="Today's Change"
            value={`$${portfolioStats.todayChange.toLocaleString()}`}
            subtitle={`${portfolioStats.todayChangePercent > 0 ? '+' : ''}${portfolioStats.todayChangePercent}%`}
            color={portfolioStats.todayChange > 0 ? 'success.main' : 'error.main'}
          />
          <StatCard
            icon={<Assessment />}
            title="Total Return"
            value={`$${portfolioStats.totalReturn.toLocaleString()}`}
            subtitle={`${portfolioStats.totalReturnPercent}% gain`}
            color="success.main"
          />
          <StatCard
            icon={<Timeline />}
            title="Active Assets"
            value="12"
            subtitle="Across different sectors"
            color="info.main"
          />
      </Grid>

      <Grid container spacing={3}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Portfolio Performance
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Chart will be implemented here</Typography>
            </Box>
          </Paper>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Asset Allocation
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: 'text.secondary'
              }}
            >
              <Typography>Pie chart will be implemented here</Typography>
            </Box>
          </Paper>
      </Grid>
    </Box>
  );
};

export default Dashboard;
