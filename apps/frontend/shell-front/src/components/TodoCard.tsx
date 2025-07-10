import { useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CuteFallingStars from './CuteFallingStars';
import WelcomeTumbaland from './WelcomeTumbaland';
import BgImageBox from './BgImageBox';
import { usePerformanceOptimizations } from '../hooks/usePerformanceOptimizations';
import { useTodo } from '../hooks/useTodo';

export default function TodoCard() {
  const { todo, isLoading, error, fetchTodo } = useTodo();
  const { isMobile, prefersReducedMotion } = usePerformanceOptimizations();

  // Memoize button styles to avoid recreating objects on every render
  const buttonBaseStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    background: 'none',
    border: 'none',
    outline: 'none',
    padding: 0,
    width: 44,
    height: 44,
    borderRadius: '50%',
    transition: 'background 0.18s, transform 0.1s',
    opacity: isLoading ? 0.6 : 1,
  }), [isLoading]);

  // Memoize hover handlers to avoid creating new functions on every render
  const handleMouseOver = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isLoading) {
      e.currentTarget.style.background = 'rgba(255,31,174,0.12)';
    }
  }, [isLoading]);

  const handleMouseOut = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'none';
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isLoading) {
      e.currentTarget.style.transform = 'scale(0.92)';
    }
  }, [isLoading]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  }, []);

  // Memoize card styles with mobile-optimized backdrop filter
  const cardStyle = useMemo(() => ({
    position: 'relative' as const,
    zIndex: 1,
    bgcolor: 'rgba(255,255,255,0.18)',
    p: 4,
    borderRadius: 4,
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
    minWidth: 340,
    maxWidth: 400,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    // Reduce backdrop filter intensity on mobile for better performance
    backdropFilter: isMobile ? 'blur(4px) saturate(140%)' : 'blur(8px) saturate(160%)',
    WebkitBackdropFilter: isMobile ? 'blur(4px) saturate(140%)' : 'blur(8px) saturate(160%)',
    border: '1.5px solid rgba(255,255,255,0.32)',
    // Add transform3d to enable hardware acceleration
    transform: 'translate3d(0, 0, 0)',
  }), [isMobile]);

  // Determine particle count based on device and performance preferences
  const particleCount = useMemo(() => {
    if (prefersReducedMotion) return 0;
    if (isMobile) return 8;
    return 24;
  }, [isMobile, prefersReducedMotion]);

  return (
    <>
      {/* Conditionally render particles based on performance preferences */}
      {particleCount > 0 && <CuteFallingStars count={particleCount} />}
      {/* Main content */}
      <Box sx={{
        minHeight: '100vh',
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        // Enable hardware acceleration
        transform: 'translate3d(0, 0, 0)',
      }}>
        <WelcomeTumbaland />
        <BgImageBox />
        <Box sx={cardStyle}>
          <p style={{
            fontSize: 22,
            fontWeight: 500,
            color: error ? '#ff4444' : '#ff1fae',
            margin: '24px 0 16px 0',
            minHeight: 48
          }}>
            {isLoading ? 'Rolling...' : error ? 'Failed to load todo' : (todo || 'Loading...')}
          </p>
          <button
            aria-label="Roll for new todo"
            disabled={isLoading}
            onClick={fetchTodo}
            style={buttonBaseStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            <AutorenewIcon 
              style={{ 
                fontSize: 32, 
                color: '#ff1fae', 
                filter: 'drop-shadow(0 2px 6px #ff1fae33)',
                transform: isLoading ? 'rotate(360deg)' : 'none',
                transition: prefersReducedMotion ? 'none' : 'transform 0.6s ease-in-out'
              }} 
            />
          </button>
        </Box>
      </Box>
    </>
  );
}
