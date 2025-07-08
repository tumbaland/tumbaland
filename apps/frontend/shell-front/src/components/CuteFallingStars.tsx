import { Box } from '@mui/material';

export default function CuteFallingStars({ count = 24 }: { count?: number }) {
  const symbols = ['★', '✦', '✧', '✩', '✫', '✬', '✯', '✰'];
  // Pinkish and white color palette
  const colors = [
    '#fff',
    '#ffe0f7',
    '#f8e1ff',
    '#ffd6ec',
  ];
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
      {[...Array(count)].map((_, i) => {
        const symbol = symbols[i % symbols.length];
        // Pick a random color from the palette for each star
        const color = colors[Math.floor(Math.random() * colors.length)];
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 40 + 10}px`,
              fontSize: `${Math.random() * 18 + 16}px`,
              color,
              opacity: 0.20,
              animation: `snowfall 8s linear infinite`,
              animationDelay: `${Math.random() * 8}s`,
              userSelect: 'none',
              filter: 'drop-shadow(0 1px 2px #fff4)',
            }}
          >
            {symbol}
          </Box>
        );
      })}
      <style>{`
        @keyframes snowfall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.9; }
          80% { opacity: 0.9; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0.1; }
        }
      `}</style>
    </Box>
  );
}
