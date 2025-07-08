
import { useMemo } from 'react';
import { Box } from '@mui/material';


type CuteFallingStarsProps = { count?: number };

// Precompute star properties for better performance and less layout thrash
export default function CuteFallingStars({ count = 24 }: CuteFallingStarsProps) {
  const symbols = ['★', '✦', '✧', '✩', '✫', '✬', '✯', '✰'];
  const colors = ['#fff', '#ffe0f7', '#f8e1ff', '#ffd6ec'];

  // Precompute all star properties only once per mount or count change
  const stars = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const symbol = symbols[i % symbols.length];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const top = -(Math.random() * 40 + 10);
      const fontSize = Math.random() * 18 + 16;
      const opacity = 0.18 + Math.random() * 0.18; // 0.18-0.36
      const animationDelay = Math.random() * 8;
      const rotateDir = Math.random() > 0.5 ? 1 : -1;
      const duration = 6.5 + Math.random() * 3.5; // 6.5-10s
      return {
        symbol,
        color,
        left,
        top,
        fontSize,
        opacity,
        animationDelay,
        rotateDir,
        duration,
        key: i,
      };
    });
  }, [count]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {stars.map(star => (
        <Box
          key={star.key}
          sx={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}px`,
            fontSize: `${star.fontSize}px`,
            color: star.color,
            opacity: star.opacity,
            animation: `cute-snowfall ${star.duration}s linear infinite`,
            animationDelay: `${star.animationDelay}s`,
            userSelect: 'none',
            filter: 'drop-shadow(0 1px 2px #fff4)',
            willChange: 'transform, opacity',
          }}
          style={{
            // Use CSS variable for direction
            ['--rotateDir' as any]: star.rotateDir,
          }}
        >
          {star.symbol}
        </Box>
      ))}
      <style>{`
        @keyframes cute-snowfall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.9; }
          80% { opacity: 0.9; }
          100% { transform: translateY(100vh) rotate(calc(360deg * var(--rotateDir, 1))); opacity: 0.1; }
        }
      `}</style>
    </Box>
  );
}
