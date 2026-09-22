import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Email,
  Save,
  DeleteForever,
  HourglassTop,
  Undo
} from '@mui/icons-material';
import { logger } from '@tumbaland/frontend-core';
import { authService } from '../../services/authService';
import { profileService } from '../../services/profileService';
import { squareAvatar } from '../../services/avatarImage';
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
  const [pictureBusy, setPictureBusy] = useState(false);
  const pictureInput = useRef<HTMLInputElement | null>(null);

  // Null means no request standing. Held apart from `user` because it changes
  // on its own, without the rest of the profile being reloaded.
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

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
          setDeletionRequestedAt(currentUser.deletionRequestedAt ?? null);
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

  const handlePicturePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so choosing the same photo again after an error still fires.
    event.target.value = '';
    if (!file) return;

    setPictureBusy(true);
    setMessage(null);
    try {
      const picture = await profileService.uploadPicture(await squareAvatar(file));
      setUser((previous) => (previous ? { ...previous, picture, hasCustomPicture: true } : previous));
      setMessage({ type: 'success', text: 'Picture updated.' });
    } catch (error) {
      logger.error('ProfileTab: picture upload failed', error);
      setMessage({ type: 'error', text: (error as Error).message || 'Could not save the picture' });
    } finally {
      setPictureBusy(false);
    }
  };

  const handleRemovePicture = async () => {
    setPictureBusy(true);
    setMessage(null);
    try {
      const picture = await profileService.removePicture();
      setUser((previous) => (previous ? { ...previous, picture, hasCustomPicture: false } : previous));
    } catch (error) {
      logger.error('ProfileTab: picture removal failed', error);
      setMessage({ type: 'error', text: 'Could not remove the picture. Please try again.' });
    } finally {
      setPictureBusy(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setHasChanges(false);
    }
  };

  /**
   * Ask for the account to be removed.
   *
   * A request, not a removal: nothing is deleted here, the account goes on
   * working, and an administrator removes the data by hand afterwards. The copy
   * says so, because a button labelled "delete" that quietly does not delete is
   * worse than one that never existed — somebody would leave believing their
   * data was gone.
   */
  const handleRequestDeletion = async () => {
    setDeleting(true);
    setMessage(null);

    try {
      const response = await profileService.requestDeletion();
      setDeletionRequestedAt(response.deletionRequestedAt);
      setConfirmOpen(false);
      setConfirmEmail('');
      setMessage({
        type: 'success',
        text: 'Deletion requested. Nothing has been removed yet, and you can withdraw this at any time.'
      });
    } catch (error) {
      logger.error('Failed to request account deletion', error);
      setMessage({ type: 'error', text: 'Could not send the request. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  /** Take the request back. The account was never actually altered. */
  const handleWithdrawDeletion = async () => {
    setDeleting(true);
    setMessage(null);

    try {
      await profileService.cancelDeletion();
      setDeletionRequestedAt(null);
      setMessage({ type: 'success', text: 'Request withdrawn. Your account stays as it is.' });
    } catch (error) {
      logger.error('Failed to withdraw the deletion request', error);
      setMessage({ type: 'error', text: 'Could not withdraw the request. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  const requestedOn = deletionRequestedAt
    ? new Date(deletionRequestedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  // Typing the address is the only guard here, and the action it guards is
  // slow and reversible — so it is a check against a mis-click, not a lock.
  const confirmed = confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
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
              sx={{ width: 100, height: 100, mb: 2, border: '1px solid', borderColor: 'divider', fontSize: 40 }}
              src={user?.picture || undefined}
              alt=""
            >
              {(firstName || user?.name || email).charAt(0).toUpperCase()}
            </Avatar>
            <input
              ref={pictureInput}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePicturePicked}
              data-testid="picture-input"
            />
            <Button
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none' }}
              onClick={() => pictureInput.current?.click()}
              disabled={pictureBusy}
              startIcon={pictureBusy ? <CircularProgress size={14} /> : undefined}
            >
              Change Picture
            </Button>
            {user?.hasCustomPicture && (
              <Button
                size="small"
                color="inherit"
                sx={{ textTransform: 'none', mt: 0.5, color: 'text.secondary' }}
                onClick={handleRemovePicture}
                disabled={pictureBusy}
              >
                Remove picture
              </Button>
            )}
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
          borderColor: deletionRequestedAt ? 'warning.light' : 'error.light',
          bgcolor: deletionRequestedAt ? 'rgba(237, 108, 2, 0.05)' : 'rgba(211, 47, 47, 0.04)'
        }}
      >
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: 600, color: deletionRequestedAt ? 'warning.dark' : 'error.main', mb: 1 }}
        >
          Danger Zone
        </Typography>

        {deletionRequestedAt ? (
          <>
            <Alert
              severity="warning"
              icon={<HourglassTop />}
              sx={{ mb: 2, bgcolor: 'transparent', px: 0 }}
            >
              <AlertTitle sx={{ fontWeight: 600 }}>Deletion requested</AlertTitle>
              You asked for this account to be deleted on {requestedOn}. Nothing has been removed:
              your photos, finances and journal are all still here, and you can keep using
              everything as normal until someone removes it by hand.
            </Alert>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Undo />}
              onClick={handleWithdrawDeletion}
              disabled={deleting}
              size="small"
            >
              {deleting ? 'Withdrawing…' : 'Withdraw request'}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Ask for your account and everything in it to be deleted. Nothing is removed
              straight away. The request is queued and someone deletes it by hand, so you can
              carry on using Tumbaland in the meantime and withdraw the request whenever you
              like.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForever />}
              onClick={() => setConfirmOpen(true)}
              size="small"
            >
              Request account deletion
            </Button>
          </>
        )}
      </Paper>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Request account deletion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This asks for your account and everything in it to be deleted: photos,
            transactions, journal entries, groups and API keys. It does not happen straight away.
            The request goes to a person, and until they act on it your account works exactly as
            it does now. You can withdraw the request at any point before then.
          </DialogContentText>
          <TextField
            fullWidth
            size="small"
            label="Type your email address to confirm"
            placeholder={email}
            value={confirmEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmEmail(e.target.value)}
            disabled={deleting}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRequestDeletion}
            disabled={deleting || !confirmed}
            startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : <DeleteForever />}
          >
            {deleting ? 'Sending…' : 'Request deletion'}
          </Button>
        </DialogActions>
      </Dialog>
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
