import { Box, Typography } from '@mui/material';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';

export function ErrorPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}
    >
      <HeartBrokenIcon sx={{ fontSize: 80, color: '#ef4444', mb: 2 }} />
      <Typography variant="h4" color="primary" fontWeight={700} gutterBottom>
        Something went wrong
      </Typography>
    </Box>
  );
}
