import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export function ErrorPage() {
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
      <ErrorOutlineIcon sx={{ fontSize: 80, color: 'error.main' }} />
      <Typography variant="h4" color="error" fontWeight={600} gutterBottom>
        Configuration Error
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" mb={2}>
        Failed to load application configuration.
        <br />
        Please check your network connection and try again.
      </Typography>
      <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
        Retry
      </Button>
    </Box>
  );
}
