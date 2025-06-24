import React from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  Paper 
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  List as ListIcon 
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentTab = () => {
    switch (location.pathname) {
      case '/':
        return 0;
      case '/activities':
        return 1;
      default:
        return 0;
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/');
        break;
      case 1:
        navigate('/activities');
        break;
    }
  };
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        borderRadius: 3, 
        mb: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(212, 165, 116, 0.2)',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(11, 11, 10, 0.3)' }}>
        <Tabs 
          value={getCurrentTab()} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: '#d4a574',
              height: 3,
            },
            '& .MuiTab-root': {
              color: '#8b6f47',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(212, 165, 116, 0.1)',
                color: '#d4a574',
              },
              '&.Mui-selected': {
                color: '#d4a574',
                fontWeight: 600,
                backgroundColor: 'rgba(212, 165, 116, 0.05)',
              },
            },
          }}
        >
          <Tab 
            icon={<DashboardIcon />} 
            label="Dashboard" 
            iconPosition="start"
            sx={{ 
              minHeight: 64,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
              px: 3,
            }}
          />
          <Tab 
            icon={<ListIcon />} 
            label="Activities" 
            iconPosition="start"
            sx={{ 
              minHeight: 64,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
              px: 3,
            }}
          />
        </Tabs>
      </Box>
    </Paper>
  );
};

export default Navigation;
