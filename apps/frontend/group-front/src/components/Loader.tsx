import { Box, CircularProgress, Typography } from '@mui/material';

const Loader = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#faf0e6' }}>
    <CircularProgress size={48} />
    <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>Loading...</Typography>
  </Box>
);

export default Loader;
