import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

interface LoginPromptProps {
  isLoading: boolean;
  initializationAttempted: boolean;
  error?: string | null;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({ isLoading, initializationAttempted, error }) => (
  <Box>
    {isLoading ? (
      <Box sx={{ py: 5 }}>
        <CircularProgress color="primary" />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Initializing authentication...
        </Typography>
      </Box>
    ) : (
      <Box>
        <Box id="google-signin-button" sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 56,
          border: '1px dashed #ddd',
          borderRadius: 2,
          background: '#fafafa',
          py: 2,
          mb: 2
        }}>
          {initializationAttempted ? (
            <Typography variant="body2" color="text.secondary">
              ⏳ Loading Google Sign-In...
              <br />If the button doesn't appear, try refreshing the page.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Preparing authentication...
            </Typography>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" mt={2}>
          Sign in to continue
        </Typography>
        {error && (
          <Typography variant="body2" color="error" mt={2}>{error}</Typography>
        )}
      </Box>
    )}
  </Box>
);

export default LoginPrompt;
