import React from 'react';
import { Box, Avatar, Typography, Stack, Button } from '@mui/material';

interface LoggedInUserProps {
  user: {
    name: string;
    email: string;
    picture?: string;
  };
  onContinue: () => void;
  onLogout: () => void;
}

const LoggedInUser: React.FC<LoggedInUserProps> = ({ user, onContinue, onLogout }) => (
  <Box>
    <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
      <Avatar
        src={user.picture}
        alt="Profile"
        sx={{
          width: 88,
          height: 88,
          mx: 'auto',
          border: '4px solid white',
          boxShadow: '0 12px 24px rgba(99, 102, 241, 0.15)'
        }}
      />
    </Box>
    <Typography variant="h5" fontWeight={700} color="#1e293b" gutterBottom>
      Welcome back, {user.name}!
    </Typography>
    <Typography variant="body1" color="text.secondary" mb={4}>
      {user.email}
    </Typography>
    <Stack direction="row" spacing={2} justifyContent="center">
      <Button
        variant="contained"
        color="primary"
        onClick={onContinue}
        disableElevation
        sx={{
          px: 4,
          py: 1,
          borderRadius: 3,
          textTransform: 'none',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }
        }}
      >
        Continue
      </Button>
      <Button
        variant="outlined"
        color="error"
        onClick={onLogout}
        sx={{
          px: 4,
          py: 1,
          borderRadius: 3,
          textTransform: 'none',
          fontWeight: 600,
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            background: 'rgba(239, 68, 68, 0.04)'
          }
        }}
      >
        Logout
      </Button>
    </Stack>
  </Box>
);

export default LoggedInUser;
