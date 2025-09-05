import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  Divider
} from '@mui/material';
import { Person, Email } from '@mui/icons-material';

const ProfileTab: React.FC = () => {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Person sx={{ mr: 1 }} />
          Profile Information
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
          <Box sx={{ flex: { xs: 1, md: '0 0 200px' }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar
              sx={{ width: 120, height: 120, mb: 2 }}
              src="/placeholder-avatar.jpg"
            />
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="First Name"
              defaultValue=""
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Last Name"
              defaultValue=""
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Email"
              defaultValue=""
              variant="outlined"
              InputProps={{
                startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined">Cancel</Button>
          <Button variant="contained">Save Changes</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProfileTab;
