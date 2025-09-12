import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { Lock, Login } from '@mui/icons-material';

export interface UnauthorizedPageProps {
  onLogin: () => void;
}

export const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ onLogin }) => {
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Lock sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />

        <Typography variant="h4" component="h1" gutterBottom color="primary">
          Access Restricted
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          You need to be logged in to access the Tumbaland.
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Button variant="contained" size="large" startIcon={<Login />} onClick={onLogin} sx={{ px: 4, py: 1.5 }}>
            Sign In to Continue
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};
