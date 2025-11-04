import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Button
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'transparent',
          color: '#222',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              color="inherit"
              onClick={() => navigate('/trainings')}
              sx={{
                fontWeight: isActive('/trainings') ? 700 : 500,
                textTransform: 'none',
                background: 'none',
                borderRadius: 2,
                px: 2,
                color: isActive('/trainings') ? 'primary.main' : '#222',
                '&:hover': { background: 'rgba(0,0,0,0.04)' }
              }}
            >
              Trainings
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/configs')}
              sx={{
                fontWeight: isActive('/configs') ? 700 : 500,
                textTransform: 'none',
                background: 'none',
                borderRadius: 2,
                px: 2,
                color: isActive('/configs') ? 'primary.main' : '#222',
                '&:hover': { background: 'rgba(0,0,0,0.04)' }
              }}
            >
              Configs
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/analysis')}
              sx={{
                fontWeight: isActive('/analysis') ? 700 : 500,
                textTransform: 'none',
                background: 'none',
                borderRadius: 2,
                px: 2,
                color: isActive('/analysis') ? 'primary.main' : '#222',
                '&:hover': { background: 'rgba(0,0,0,0.04)' }
              }}
            >
              Datasets
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/image-labeling')}
              sx={{
                fontWeight: isActive('/image-labeling') ? 700 : 500,
                textTransform: 'none',
                background: 'none',
                borderRadius: 2,
                px: 2,
                color: isActive('/image-labeling') ? 'primary.main' : '#222',
                '&:hover': { background: 'rgba(0,0,0,0.04)' }
              }}
            >
              Image Labeling
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: '#fafafa' }}>
        {children}
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          bgcolor: '#fff',
          borderTop: '1px solid rgba(0,0,0,0.1)'
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">

          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
