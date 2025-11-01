import React from 'react';
import { Box, Typography, Paper, Container, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import ActivityTypesManagement from '../components/ActivityTypesManagement';
import { useTenantFilter } from '../components/tenant';

const ActivityTypesPage: React.FC = () => {
  const groupId = useTenantFilter();
  console.log('ActivityTypesPage rendered with groupId:', groupId);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
                <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: { xs: 'flex-start', sm: 'space-between' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
            mb: 3
          }}
        >
          <Typography variant="h4" component="h1" sx={{ mb: { xs: 1, sm: 0 } }}>
            Activity Types
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              const event = new CustomEvent('openCreateActivityTypeDialog');
              window.dispatchEvent(event);
            }}
          >
            Add Activity Type
          </Button>
        </Box>

        <Paper sx={{ p: 3 }}>
          <ActivityTypesManagement groupId={groupId} />
        </Paper>
      </Box>
    </Container>
  );
};

export default ActivityTypesPage;