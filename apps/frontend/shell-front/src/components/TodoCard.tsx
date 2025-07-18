import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Box, Fade, Paper, IconButton } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CuteFallingStars from './CuteFallingStars';
import WelcomeTumbaland from './WelcomeTumbaland';
import BgImageBox from './BgImageBox';
import { usePerformanceOptimizations } from '../hooks/usePerformanceOptimizations';
import { useTodo } from '../hooks/useTodo';

export default function TodoCard() {
  const { todo, isLoading, error, fetchTodo } = useTodo();
  const { isMobile, prefersReducedMotion } = usePerformanceOptimizations();
  const [isRotating, setIsRotating] = useState(false);
  const [todoVisible, setTodoVisible] = useState(true);
  const [currentTodo, setCurrentTodo] = useState(todo);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update current todo when new one is loaded
  useEffect(() => {
    if (todo && !isLoading) {
      // Small delay to create smooth fade effect
      const timer = setTimeout(() => {
        setCurrentTodo(todo);
        setTodoVisible(true);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [todo, isLoading]);

  // Enhanced click handler with animations
  const handleFetchTodo = useCallback(async () => {
    if (isLoading || isRotating) return;

    // Start animations
    setIsRotating(true);
    setTodoVisible(false);
    setRotationDegrees(prev => prev + 360); // Always rotate forward

    // Clear any existing timeout
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current);
    }

    // Fetch new todo
    await fetchTodo();

    // Stop rotation after animation duration
    rotationTimeoutRef.current = setTimeout(() => {
      setIsRotating(false);
    }, 300);
  }, [isLoading, isRotating, fetchTodo]);

  // Enhanced card design with glassmorphism effect
  const cardStyle = useMemo(
    () => ({
      position: 'relative' as const,
      zIndex: 1,
      // Modern glassmorphism gradient
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.12))',
      p: { xs: 3, sm: 4 },
      borderRadius: 4,
      boxShadow: '0 25px 50px 0 rgba(31, 38, 135, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      minWidth: { xs: 320, sm: 380 },
      maxWidth: 420,
      minHeight: 200,
      textAlign: 'center' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      // Enhanced backdrop filter for better blur effect
      backdropFilter: isMobile ? 'blur(15px) saturate(180%)' : 'blur(25px) saturate(200%)',
      WebkitBackdropFilter: isMobile ? 'blur(15px) saturate(180%)' : 'blur(25px) saturate(200%)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      transform: 'translate3d(0, 0, 0)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translate3d(0, -6px, 0) scale(1.02)',
        boxShadow: '0 35px 70px 0 rgba(31, 38, 135, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.15))'
      }
    }),
    [isMobile]
  );

  // Determine particle count based on device and performance preferences
  const particleCount = useMemo(() => {
    if (prefersReducedMotion) return 0;
    if (isMobile) return 8;
    return 24;
  }, [isMobile, prefersReducedMotion]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {particleCount > 0 && <CuteFallingStars count={particleCount} />}
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          transform: 'translate3d(0, 0, 0)'
        }}
      >
        <WelcomeTumbaland />
        <BgImageBox />
        <Paper sx={cardStyle} elevation={0}>
          <Fade in={todoVisible && !isLoading} timeout={400}>
            <Box
              sx={{
                minHeight: 96, // Fixed height for 3 lines of text
                maxHeight: 96, // Prevent growing beyond 3 lines
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden' // Prevent text overflow
              }}
            >
              <Box
                component="p"
                sx={{
                  fontSize: { xs: 20, sm: 24 },
                  fontWeight: 300,
                  color: error ? '#ff6b6b' : '#ff1fae',
                  margin: 0,
                  lineHeight: 1.4,
                  textShadow: '0 2px 8px rgba(255, 31, 174, 0.3)',
                  transition: 'all 0.3s ease',
                  px: 2,
                  textAlign: 'center',
                  display: '-webkit-box',
                  WebkitLineClamp: 3, // Limit to 3 lines
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {error ? 'Failed to load todo' : currentTodo || 'Loading...'}
              </Box>
            </Box>
          </Fade>

          <IconButton
            aria-label="Roll for new todo"
            disabled={isLoading || isRotating}
            onClick={handleFetchTodo}
            sx={{
              width: 56,
              height: 56,
              border: '2px solid rgba(255, 31, 174, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                border: '2px solid rgba(255, 31, 174, 0.5)',
                transform: 'scale(1.05)',
                boxShadow: '0 8px 20px rgba(255, 31, 174, 0.4)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              },
              '&:disabled': {
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            }}
          >
            <AutorenewIcon
              sx={{
                fontSize: 32,
                color: '#ff1fae',
                filter: 'drop-shadow(0 2px 8px rgba(255, 31, 174, 0.4))',
                transform: `rotate(${rotationDegrees}deg)`,
                transition: prefersReducedMotion ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </IconButton>
        </Paper>
      </Box>
    </>
  );
}
