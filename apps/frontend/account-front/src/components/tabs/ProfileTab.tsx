import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Email, Save, DeleteForever } from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { authService } from '../../services/authService';
import { profileService } from '../../services/profileService';
import { User } from '../../types';

const ProfileTab: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
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
          logger.debug('ProfileTab: user not authenticated, redirecting to login');
          authService.redirectToLogin();
          return;
        }

        const currentUser = await authService.getProfile();

        if (currentUser) {
          setUser(currentUser);
          setEmail(currentUser.email);
          setFirstName(currentUser.firstName || '');
          setLastName(currentUser.lastName || '');
        } else {
          logger.error('ProfileTab: no profile data received');
          setMessage({ type: 'error', text: 'Failed to load profile data' });
        }
      } catch (error) {
        logger.error('ProfileTab: failed to load user data', error);
        // Check if it's an authentication error
        if (error instanceof Error && error.message.includes('401')) {
          logger.debug('ProfileTab: authentication error, redirecting to login');
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
      logger.error('Failed to update profile', error);
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

  const handleDeleteAccount = () => {
    // Placeholder for delete account functionality
    alert('Account deletion is not implemented yet. This is a demo.');
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 2, px: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Account Settings
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      {/* Personal Information */}
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: 3, 
          borderRadius: 3, 
          border: '1px solid', 
          borderColor: 'divider' 
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Personal Information
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>
            <Avatar
              sx={{ width: 100, height: 100, mb: 2, border: '1px solid', borderColor: 'divider' }}
              src={user?.picture || "/placeholder-avatar.jpg"}
            />
            <Button size="small" variant="outlined" sx={{ textTransform: 'none' }}>
              Change Picture
            </Button>
          </Box>
          
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                variant="outlined"
                size="small"
                disabled={saving}
              />
              <TextField
                fullWidth
                label="Last Name"
                value={lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                variant="outlined"
                size="small"
                disabled={saving}
              />
            </Box>
            <TextField
              fullWidth
              label="Email Address"
              value={email}
              variant="outlined"
              size="small"
              disabled
              helperText="Managed via your login provider"
              slotProps={{
                input: {
                  startAdornment: <Email sx={{ mr: 1, color: 'action.active', fontSize: 20 }} />
                }
              }}
            />
            {user?.lastLoginAt && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Last login: {new Date(user.lastLoginAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
      {/* Preferences */}
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: 3, 
          borderRadius: 3, 
          border: '1px solid', 
          borderColor: 'divider' 
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Preferences
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              color="primary"
            />
          }
          label="Receive email notifications about account activity"
        />
      </Paper>
      {/* Danger Zone */}
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2, md: 3 }, 
          mb: 3, 
          borderRadius: 3, 
          border: '1px solid', 
          borderColor: 'error.light',
          bgcolor: 'rgba(211, 47, 47, 0.04)'
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'error.main', mb: 1 }}>
          Danger Zone
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          Permanently delete your account and all of your content.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteForever />}
          onClick={handleDeleteAccount}
          size="small"
        >
          Delete Account
        </Button>
      </Paper>
      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          disabled={saving || !hasChanges}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Save Changes
        </Button>
      </Box>
    </Box>
  );
};

export default ProfileTab;
