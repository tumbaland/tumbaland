import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';
import ActivityTypesManagement from '../components/ActivityTypesManagement';
import { useTenantFilter } from '../components/tenant';

const ActivityTypesPage: React.FC = () => {
  const groupId = useTenantFilter();
  console.log('ActivityTypesPage rendered with groupId:', groupId);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Activity Types Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create, edit, and manage activity types for your activities. Activity types help categorize and organize your relationship activities.
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <ActivityTypesManagement groupId={groupId} />
        </Paper>
      </Box>
    </Container>
  );
};

export default ActivityTypesPage;