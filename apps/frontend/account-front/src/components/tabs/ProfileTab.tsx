import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { Person, Email } from '@mui/icons-material';
import { authService } from '../../services/authService';
import { profileService } from '../../services/profileService';
import { User } from '../../types';

const ProfileTab: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {        
        // First check if user is authenticated
        const isAuth = await authService.isAuthenticated();
        
        if (!isAuth) {
          console.log('ProfileTab: User not authenticated, redirecting to login');
          authService.redirectToLogin();
          return;
        }

        const currentUser = await authService.getProfile();
        
        if (currentUser) {
          setUser(currentUser);
          setEmail(currentUser.email);
          setFirstName(currentUser.firstName || '');
          setLastName(currentUser.lastName || '');
          console.log('ProfileTab: Profile data set successfully');
        } else {
          console.error('ProfileTab: No profile data received');
          setMessage({ type: 'error', text: 'Failed to load profile data' });
        }
      } catch (error) {
        console.error('ProfileTab: Failed to load user data:', error);
        // Check if it's an authentication error
        if (error instanceof Error && error.message.includes('401')) {
          console.log('ProfileTab: Authentication error, redirecting to login');
          authService.redirectToLogin();
          return;
        }
        setMessage({ type: 'error', text: 'Failed to load user data' });
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Track changes
  useEffect(() => {
    if (user) {
      const currentFirstName = user.firstName || '';
      const currentLastName = user.lastName || '';
      setHasChanges(firstName !== currentFirstName || lastName !== currentLastName);
    }
  }, [firstName, lastName, user]);

  const handleSave = async () => {
    if (!user || !hasChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      };

      const response = await profileService.updateProfile(updateData);
      
      if (response.success) {
        setUser(response.user);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setHasChanges(false);
      } else {
        setMessage({ type: 'error', text: response.message || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Person sx={{ mr: 1 }} />
          Profile Information
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
          <Box sx={{ flex: { xs: 1, md: '0 0 200px' }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar
              sx={{ width: 120, height: 120, mb: 2 }}
              src={user?.picture || "/placeholder-avatar.jpg"}
            />
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              variant="outlined"
              disabled={saving}
            />
            <TextField
              fullWidth
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              variant="outlined"
              disabled={saving}
            />
            <TextField
              fullWidth
              label="Email"
              value={email}
              variant="outlined"
              disabled
              InputProps={{
                startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />
              }}
              helperText="Email cannot be changed"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handleCancel}
            disabled={saving || !hasChanges}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={saving || !hasChanges}
            startIcon={saving ? <CircularProgress size={20} /> : undefined}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProfileTab;
