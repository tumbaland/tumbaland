import { useMemo, memo } from 'react';
import { Box } from '@mui/material';
import { usePerformanceOptimizations } from '../hooks/usePerformanceOptimizations';

function SparkleStars({ count = 16 }: { count?: number }) {
  const symbols = ['✦', '✧', '✩', '★'];
  const colors = [
    '#ffe0f7',
    '#ffb6de',
    '#ffd6fa',
    '#ffb4fa',
    '#fff7b2',
    '#f6baff',
    '#b2e7ff',
    '#e6ffb2',
    '#fff'
  ];

  // Precompute all star properties only once per mount or count change
  const stars = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 96 + 1;
      const top = Math.random() * 80 + 2;
      const size = Math.random() * 6 + 8;
      const duration = Math.random() * 0.6 + 1.2;
      const delay = Math.random() * 2;
      return {
        symbol,
        color,
        left,
        top,
        size,
        duration,
        delay,
        key: i
      };
    });
  }, [count]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2
      }}
    >
      {stars.map((star) => (
        <Box
          key={star.key}
          sx={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            fontSize: `${star.size}px`,
            color: star.color,
            opacity: 0.9,
            animation: `sparkleStar ${star.duration}s ease-in-out ${star.delay}s infinite`,
            userSelect: 'none',
            willChange: 'opacity'
          }}
        >
          {star.symbol}
        </Box>
      ))}
      <style>{`
        @keyframes sparkleStar {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
}

const WelcomeTumbaland = memo(function WelcomeTumbaland() {
  const { isIOS, prefersReducedMotion, isLowEndDevice } = usePerformanceOptimizations();
  const showStars = !prefersReducedMotion && !isIOS;
  const starCount = isLowEndDevice ? 8 : 16;
  return (
    <Box sx={{ position: 'relative', display: 'inline-block', mb: 4, mt: 2 }}>
      <Box
        sx={{
          textAlign: 'center',
          fontFamily: '"Pacifico", cursive',
          fontWeight: 400,
          fontSize: { xs: 42, sm: 56, md: 64 },
          background: 'linear-gradient(135deg, #ff1fae 0%, #8b5cf6 100%)',
          backgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
          letterSpacing: 1.5,
          // Add padding to prevent the cursive font from being clipped
          p: 2,
          zIndex: 1,
          position: 'relative',
          transition: 'transform 0.3s ease',
          '&:hover': {
            transform: 'scale(1.02)'
          }
        }}
      >
        Welcome to Tumbaland
      </Box>
  {showStars && <SparkleStars count={starCount} />}
    </Box>
  );
});

export default WelcomeTumbaland;
