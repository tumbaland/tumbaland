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
    <Avatar src={user.picture} alt="Profile" sx={{ width: 64, height: 64, mx: 'auto', mb: 2 }} />
    <Typography variant="h6" fontWeight={600} color="primary">Welcome back, {user.name}!</Typography>
    <Typography variant="body2" color="text.secondary" mb={2}>{user.email}</Typography>
    <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
      <Button variant="contained" color="primary" onClick={onContinue} sx={{ px: 4, borderRadius: 3 }}>
        Continue
      </Button>
      <Button variant="outlined" color="error" onClick={onLogout} sx={{ px: 4, borderRadius: 3 }}>
        Logout
      </Button>
    </Stack>
  </Box>
);

export default LoggedInUser;
