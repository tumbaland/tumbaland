import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions
} from '@mui/material';
import { PlayArrow, Stop, Timer } from '@mui/icons-material';

interface TimeSession {
  id: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  activity: string;
}

const TimeTracker: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TimeSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activity, setActivity] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isTracking && currentSession) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - currentSession.startTime.getTime());
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, currentSession]);

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTracking = () => {
    setDialogOpen(true);
  };

  const confirmStart = () => {
    if (!activity.trim()) return;
    
    const session: TimeSession = {
      id: Date.now(),
      startTime: new Date(),
      activity: activity.trim()
    };
    
    setCurrentSession(session);
    setIsTracking(true);
    setElapsedTime(0);
    setDialogOpen(false);
    setActivity('');
  };

  const stopTracking = () => {
    if (currentSession) {
      const endTime = new Date();
      const duration = endTime.getTime() - currentSession.startTime.getTime();
      
      const completedSession = {
        ...currentSession,
        endTime,
        duration
      };
      
      // Here you would typically save to backend
      console.log('Session completed:', completedSession);
      
      setCurrentSession(null);
      setIsTracking(false);
      setElapsedTime(0);
    }
  };

  return (
    <Card sx={{ mb: 3, border: isTracking ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Timer sx={{ color: isTracking ? 'success.main' : 'grey.500' }} />
            <Box>
              <Typography variant="h6">
                Time Together Tracker
              </Typography>
              {isTracking && currentSession && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Chip 
                    label={currentSession.activity} 
                    color="primary" 
                    size="small" 
                  />
                  <Typography variant="body2" color="text.secondary">
                    Started: {currentSession.startTime.toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isTracking && (
              <Typography variant="h4" sx={{ fontFamily: 'monospace', color: 'success.main' }}>
                {formatTime(elapsedTime)}
              </Typography>
            )}
            
            {!isTracking ? (
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={startTracking}
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
              >
                Start Tracking
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Stop />}
                onClick={stopTracking}
                sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
              >
                Stop Tracking
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>

      {/* Activity Selection Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start Time Tracking</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="What are you doing together?"
            fullWidth
            variant="outlined"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="e.g., Cooking dinner, Watching movies, Playing games..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmStart} 
            variant="contained"
            disabled={!activity.trim()}
          >
            Start Tracking
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default TimeTracker;
