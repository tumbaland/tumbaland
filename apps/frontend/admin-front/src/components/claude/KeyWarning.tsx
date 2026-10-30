import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { appPath } from '../../appBase';
import { useLoad } from '../../hooks/useLoad';
import { adminApi } from '../../services/adminApi';

/**
 * On the Overview: the assistants' key needs attention. Shown only when it is
 * rejected or close to its date; a key that is fine, or not set up at all, says
 * nothing here, and neither does a page that could not ask.
 */
export function KeyWarning() {
  const { data } = useLoad(() => adminApi.claudeKey(), []);
  if (!data?.configured) return null;

  const open = (
    <Button color="inherit" size="small" component={RouterLink} to={appPath('/claude')}>
      Open
    </Button>
  );

  if (data.status === 'rejected') {
    return (
      <Alert severity="error" action={open} sx={{ mb: 2 }}>
        Anthropic is no longer accepting the key the chat assistants use, so they are off for everyone.
      </Alert>
    );
  }
  if (data.expiringSoon && data.daysLeft !== null) {
    return (
      <Alert severity="warning" action={open} sx={{ mb: 2 }}>
        {data.daysLeft < 0
          ? 'The key the chat assistants use is past its expiry date.'
          : data.daysLeft === 0
            ? 'The key the chat assistants use expires today.'
            : `The key the chat assistants use expires in ${data.daysLeft} day${data.daysLeft === 1 ? '' : 's'}.`}
      </Alert>
    );
  }
  return null;
}
