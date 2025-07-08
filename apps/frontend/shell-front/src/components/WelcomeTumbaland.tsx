import { Box } from '@mui/material';

function SparkleStars({ count = 69 }: { count?: number }) {
  const symbols = ['✦', '✧', '✩', '✫', '✬', '✯', '✰', '★', '❉', '❋'];
  const colors = [
    '#ffe0f7', // pastel pink
    '#ffb6de', // pastel rose
    '#ffd6fa', // pastel lavender
    '#ffb4fa', // pastel magenta
    '#ffb4e6', // pastel blush
    '#ffe6fa', // pastel light pink
    '#fff0e6', // pastel peach
    '#fff7b2', // pastel yellow
    '#ffd6e6', // pastel light rose
    '#f6baff', // pastel blue
    '#baffc9', // pastel mint
    '#b2e7ff', // pastel sky blue
    '#b2ffd6', // pastel green
    '#e6ffb2', // pastel lime
    '#ffe6b2', // pastel orange
    '#e6e6ff', // pastel violet
    '#b2baff', // pastel periwinkle
    '#ffd6b2', // pastel apricot
    '#e6ffd6', // pastel light green
    '#ffd6d6', // pastel coral
    '#e6f7ff', // pastel icy blue
    '#d6ffe6', // pastel teal
    '#f7e6ff', // pastel lilac
    '#f7ffd6', // pastel lemon
    '#d6e6ff', // pastel baby blue
    '#f7e6d6', // pastel cream
    '#e6fff7', // pastel aqua
    '#f7d6ff', // pastel orchid
    '#d6fff7', // pastel turquoise
    '#f7d6d6', // pastel blush red
    '#fff',    // keep a few white for sparkle
    '#fff',
    '#fff',
  ];
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {[...Array(count)].map((_, i) => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 96 + 1;
        const top = Math.random() * 80 + 2;
        const size = Math.random() * 8 + 6; // smaller stars
        const duration = Math.random() * 0.8 + 0.8; // faster sparkle
        const delay = Math.random() * 1.5;
        // Add a random rotation direction and speed for each star
        const rotateDir = Math.random() > 0.5 ? 1 : -1;
        const rotateDuration = (Math.random() * 1.2 + 1.2).toFixed(2);
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              fontSize: `${size}px`,
              color,
              opacity: 0.95,
              filter: 'drop-shadow(0 0 8px #fff) drop-shadow(0 0 16px #fff8)',
              animation: `sparkleStar ${duration}s ease-in-out ${delay}s infinite, sparkleRotate ${rotateDuration}s linear ${delay}s infinite`,
              userSelect: 'none',
            }}
          >
            {symbol}
          </Box>
        );
      })}
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
      `}</style>
    </Box>
  );
}

export default function WelcomeTumbaland() {
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
          position: 'relative',
        }}
      >
        Welcome to Tumbaland
      </Box>
      <SparkleStars count={69} />
    </Box>
  );
}
