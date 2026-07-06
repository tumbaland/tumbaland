import React from 'react';
import { Box, Typography, Container, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import ActivityTypesManagement from '../components/ActivityTypesManagement';
import { useTenantFilter } from '@tumbaland/components';

const ActivityTypesPage: React.FC = () => {
  const groupId = useTenantFilter();

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
            sx={{ 
              bgcolor: 'primary.main',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: 'primary.dark',
                boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
              }
            }}
          >
            Add Activity Type
          </Button>
        </Box>

        <ActivityTypesManagement groupId={groupId} />
      </Box>
    </Container>
  );
};

export default ActivityTypesPage;