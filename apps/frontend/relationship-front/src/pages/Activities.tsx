import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  Button,
  Rating
} from '@mui/material';
import { Add, Restaurant, Movie, SportsEsports, Flight } from '@mui/icons-material';

const Activities: React.FC = () => {
  // Mock activity data
  const activities = [
    {
      id: 1,
      date: '2025-06-20',
      activity: 'Cooking Together',
      duration: 2.5,
      rating: 5,
      icon: <Restaurant />,
      description: 'Made homemade pasta and tiramisu'
    },
    {
      id: 2,
      date: '2025-06-19',
      activity: 'Movie Night',
      duration: 3,
      rating: 4,
      icon: <Movie />,
      description: 'Watched "The Princess Bride" with popcorn'
    },
    {
      id: 3,
      date: '2025-06-18',
      activity: 'Gaming Session',
      duration: 4,
      rating: 5,
      icon: <SportsEsports />,
      description: 'Co-op game: It Takes Two'
    },
    {
      id: 4,
      date: '2025-06-15',
      activity: 'Weekend Trip',
      duration: 48,
      rating: 5,
      icon: <Flight />,
      description: 'Beach weekend getaway'
    }
  ];

  const getActivityColor = (activity: string) => {
    const colors: { [key: string]: string } = {
      'Cooking Together': 'warning',
      'Movie Night': 'primary',
      'Gaming Session': 'secondary',
      'Weekend Trip': 'success'
    };
    return colors[activity] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Activities Together
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: 'primary.main' }}
        >
          Add Activity
        </Button>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Activity</TableCell>
                <TableCell align="right">Duration (hrs)</TableCell>
                <TableCell align="center">Rating</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>{activity.date}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {activity.icon}
                      <Chip
                        label={activity.activity}
                        color={getActivityColor(activity.activity) as any}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">{activity.duration}</TableCell>
                  <TableCell align="center">
                    <Rating value={activity.rating} readOnly size="small" />
                  </TableCell>
                  <TableCell>{activity.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default Activities;
