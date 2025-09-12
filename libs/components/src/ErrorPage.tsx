import { Box, Typography, Button } from '@mui/material';
import { ReactNode } from 'react';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface ErrorPageProps {
  title?: string;
  message?: string | ReactNode;
  icon?: ReactNode;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorPage({
  title = 'Configuration Error',
  message = (
    <>
      Failed to load application configuration.
      <br />
      Please check your network connection and try again.
    </>
  ),
  icon = <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main' }} />,
  showRetry = true,
  onRetry = () => window.location.reload()
}: ErrorPageProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2
      }}
    >
      {icon}
      <Typography variant="h4" color="error" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" mb={showRetry ? 2 : 0}>
        {message}
      </Typography>
      {showRetry && (
        <Button variant="contained" color="primary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Box>
  );
}
