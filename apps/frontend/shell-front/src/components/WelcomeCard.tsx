import { Box } from '@mui/material';

export default function WelcomeCard() {
  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative background shapes */}
      <Box sx={{
        position: 'absolute',
        top: -120,
        left: -120,
        width: 320,
        height: 320,
        bgcolor: 'primary.light',
        opacity: 0.18,
        borderRadius: '50%',
        zIndex: 0,
        filter: 'blur(12px)'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: -100,
        right: -100,
        width: 260,
        height: 260,
        bgcolor: 'secondary.light',
        opacity: 0.15,
        borderRadius: '50%',
        zIndex: 0,
        filter: 'blur(10px)'
      }} />
    </Box>
  );
}
