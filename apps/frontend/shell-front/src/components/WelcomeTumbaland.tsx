import { useMemo, memo } from 'react';
import { Box } from '@mui/material';

function SparkleStars({ count = 69 }: { count?: number }) {
  const symbols = ['✦', '✧', '✩', '✫', '✬', '✯', '✰', '★', '❉', '❋'];
  const colors = [
    '#ffe0f7',
    '#ffb6de',
    '#ffd6fa',
    '#ffb4fa',
    '#ffb4e6',
    '#ffe6fa',
    '#fff0e6',
    '#fff7b2',
    '#ffd6e6',
    '#f6baff',
    '#baffc9',
    '#b2e7ff',
    '#b2ffd6',
    '#e6ffb2',
    '#ffe6b2',
    '#e6e6ff',
    '#b2baff',
    '#ffd6b2',
    '#e6ffd6',
    '#ffd6d6',
    '#e6f7ff',
    '#d6ffe6',
    '#f7e6ff',
    '#f7ffd6',
    '#d6e6ff',
    '#f7e6d6',
    '#e6fff7',
    '#f7d6ff',
    '#d6fff7',
    '#f7d6d6',
    '#fff',
    '#fff',
    '#fff'
  ];

  // Precompute all star properties only once per mount or count change
  const stars = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 96 + 1;
      const top = Math.random() * 80 + 2;
      const size = Math.random() * 8 + 6;
      const duration = Math.random() * 0.8 + 0.8;
      const delay = Math.random() * 1.5;
      const rotateDir = Math.random() > 0.5 ? 1 : -1;
      const rotateDuration = (Math.random() * 1.2 + 1.2).toFixed(2);
      return {
        symbol,
        color,
        left,
        top,
        size,
        duration,
        delay,
        rotateDir,
        rotateDuration,
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
            opacity: 0.95,
            filter: 'drop-shadow(0 0 8px #fff) drop-shadow(0 0 16px #fff8)',
            animation: `sparkleStar ${star.duration}s ease-in-out ${star.delay}s infinite, sparkleRotate${star.rotateDir === 1 ? '' : 'Reverse'} ${star.rotateDuration}s linear ${star.delay}s infinite`,
            userSelect: 'none',
            willChange: 'transform, opacity'
          }}
        >
          {star.symbol}
        </Box>
      ))}
      <style>{`
        @keyframes sparkleStar {
          0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 8px #fff) drop-shadow(0 0 16px #fff8); }
          30% { opacity: 1; filter: drop-shadow(0 0 16px #fff) drop-shadow(0 0 32px #fff8); }
          60% { opacity: 1; filter: drop-shadow(0 0 24px #fff) drop-shadow(0 0 48px #fff8); }
        }
        @keyframes sparkleRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sparkleRotateReverse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
      `}</style>
    </Box>
  );
}

const WelcomeTumbaland = memo(function WelcomeTumbaland() {
  return (
    <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
      <Box
        sx={{
          textAlign: 'center',
          fontFamily: '"Pacifico", cursive, Inter, sans-serif',
          fontWeight: 800,
          fontSize: 52,
          color: '#ff1fae',
          letterSpacing: 2,
          zIndex: 1,
          position: 'relative'
        }}
      >
        Welcome to Tumbaland
      </Box>
      <SparkleStars count={69} />
    </Box>
  );
});

export default WelcomeTumbaland;
