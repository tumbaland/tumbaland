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
import { Person, Email, Notifications, Security, Save, Cancel, DeleteForever } from '@mui/icons-material';
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 2 }}>
      {/* Hero Header */}
      <Box
        sx={{
          textAlign: 'center',
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 3,
          p: 3,
          color: 'white'
        }}
      >
        <Person sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          Account Settings
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Manage your profile, account preferences, and security settings
        </Typography>
      </Box>

      <Box sx={{ px: 2 }}>

      {/* Profile Section */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Box
          sx={{
            height: 80,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
            <Person sx={{ color: 'white' }} />
          </Avatar>
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
            Personal Information
          </Typography>

          {message && (
            <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
            <Box sx={{ flex: { xs: 1, md: '0 0 200px' }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar
                sx={{ width: 120, height: 120, mb: 2, border: '4px solid', borderColor: 'primary.light' }}
                src={user?.picture || "/placeholder-avatar.jpg"}
              />
              <Typography variant="body2" color="text.secondary">
                Profile Picture
              </Typography>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                variant="outlined"
                disabled={saving}
                InputProps={{
                  startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
              <TextField
                fullWidth
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                variant="outlined"
                disabled={saving}
                InputProps={{
                  startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Account Management Section */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Box
          sx={{
            height: 80,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
            <Security sx={{ color: 'white' }} />
          </Avatar>
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
            Account Management
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email Address"
              value={email}
              variant="outlined"
              disabled
              InputProps={{
                startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />
              }}
              helperText="Changing your email could break your OAuth sign-in if it differs from your social media email."
            />
          </Box>
        </Box>
      </Paper>

      {/* Email Notifications Section */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Box
          sx={{
            height: 80,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
            <Notifications sx={{ color: 'white' }} />
          </Avatar>
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
            Email Notifications
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
            Configure your account notification preferences
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  color="primary"
                  size="medium"
                />
              }
              label="Receive email notifications"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '1rem' } }}
            />
          </Box>
        </Box>
      </Paper>

      {/* Danger Area */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '2px solid', borderColor: 'error.main' }}>
        <Box
          sx={{
            height: 80,
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
            <DeleteForever sx={{ color: 'white' }} />
          </Avatar>
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 2, textAlign: 'center', color: 'error.main' }}>
            Danger Area
          </Typography>

          <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
            This action is irreversible and will permanently delete your account and all associated data.
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteForever />}
              onClick={handleDeleteAccount}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: 'error.dark'
                }
              }}
            >
              Delete Account
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Save/Cancel Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          disabled={saving || !hasChanges}
          startIcon={<Cancel />}
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 600,
            borderColor: 'grey.400',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'grey.600',
              backgroundColor: 'grey.50'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
            }
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>
      </Box>
    </Box>
  );
};

export default ProfileTab;
