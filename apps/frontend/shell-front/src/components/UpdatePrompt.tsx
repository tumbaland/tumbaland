import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { applyUpdate } from '../services/serviceWorker';

export interface UpdatePromptProps {
  open: boolean;
  onDismiss: () => void;
}

/**
 * Offers a waiting update rather than applying it.
 *
 * `skipWaiting` replaces the running code and reloads the page. Doing that the
 * moment a deploy lands would throw away a half-typed message, so the new
 * worker sits in `waiting` until this is accepted. Dismissing keeps the current
 * version; the update applies on the next natural reload.
 */
export function UpdatePrompt({ open, onDismiss }: UpdatePromptProps) {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message="A new version is ready"
      // No auto-hide: this is a choice to make, not a notice to miss.
      onClose={(_event, reason) => reason !== 'clickaway' && onDismiss()}
      action={
        <>
          <Button color="secondary" size="small" onClick={applyUpdate}>
            Reload
          </Button>
          <Button color="inherit" size="small" onClick={onDismiss}>
            Later
          </Button>
        </>
      }
      sx={{ mb: { xs: 9, sm: 2 } }}
    />
  );
}
