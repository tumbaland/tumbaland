import { useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { profileService } from '../services/profileService';

export type ProfileMessage = { type: 'success' | 'error'; text: string } | null;

/**
 * Asking for the account to be removed, and taking the request back. The
 * outcome is reported through `setMessage`, the banner the profile page shows.
 */
export const useAccountDeletion = (setMessage: (message: ProfileMessage) => void) => {
  // Null means no request standing. Held apart from the profile because it
  // changes on its own, without the rest of it being reloaded.
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  /**
   * Ask for the account to be removed.
   *
   * A request, not a removal: nothing is deleted here, the account goes on
   * working, and an administrator removes the data by hand afterwards. The copy
   * says so, because a button labelled "delete" that quietly does not delete is
   * worse than one that never existed — somebody would leave believing their
   * data was gone.
   */
  const requestDeletion = async () => {
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
  const withdrawDeletion = async () => {
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

  return {
    deletionRequestedAt,
    setDeletionRequestedAt,
    confirmOpen,
    setConfirmOpen,
    confirmEmail,
    setConfirmEmail,
    deleting,
    requestDeletion,
    withdrawDeletion
  };
};
