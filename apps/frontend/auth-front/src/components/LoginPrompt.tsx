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
        <Typography variant="h5" fontWeight={700} color="#1e293b" mb={1}>
          Sign In
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Welcome back! Please sign in to continue.
        </Typography>

        <Box
          id="google-signin-button"
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 56,
            borderRadius: 2,
            py: 1,
            mb: 1
          }}
        >
          {initializationAttempted ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', opacity: 0.7 }}>
              Loading Google Sign-In...
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Preparing authentication...
            </Typography>
          )}
        </Box>
        
        {error && (
          <Typography variant="body2" color="error" mt={2}>
            {error}
          </Typography>
        )}
      </Box>
    )}
  </Box>
);

export default LoginPrompt;
