import { Box, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import { ink, moduleAccent } from '@tumbaland/frontend-core';
import { reveal, cardSx, Screen, ScreenHeader, TabBar } from './shared';

/**
 * How much is logged on each day of the month, 0 to 3. Graded rather than on
 * and off, because that is what the month looks like in the app: a quiet
 * Tuesday and a whole weekend are not the same square.
 */
const LOGGED = [1, 2, 0, 3, 1, 2, 0, 0, 1, 0, 2, 3, 1, 0, 0, 2, 0, 1, 3, 2, 0, 0, 1, 0, 2, 1, 3, 0, 0, 2];

const ENTRIES = [
  { title: 'Sushi House', meta: 'Dining · Fri' },
  { title: 'Futurama, two episodes', meta: 'Movies · Fri' },
  { title: 'Walk along the bay', meta: 'Outdoors · Sat' },
  { title: 'Coffee at Rukis', meta: 'Cafe · Sun' }
];

/** What the month mostly went on. */
const TOP_TYPES = [
  { name: 'Dining', count: 9 },
  { name: 'Movies', count: 7 },
  { name: 'Outdoors', count: 6 }
];

/** A trip across the month, as the journal draws it on its map. */
const MAP = { width: 276, height: 168 };
const ROUTE = 'M30,132 C62,98 86,140 118,108 C148,78 168,114 200,82 C222,60 240,72 250,56';
const PINS = [
  { x: 30, y: 132 },
  { x: 118, y: 108 },
  { x: 200, y: 82 },
  { x: 250, y: 56 }
];

export function JournalScreen({ playing }: { playing: boolean }) {
  return (
    <Screen>
      <ScreenHeader title="Journal" sub="September" accent={moduleAccent.journal} />

      <Box sx={{ ...cardSx, ...reveal(playing, 0) }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {LOGGED.map((amount, index) => (
            <Box
              key={index}
              sx={{
                height: 15,
                borderRadius: '4px',
                background: amount === 0 ? 'rgba(15,23,42,0.05)' : moduleAccent.journal,
                opacity: playing ? [1, 0.35, 0.65, 1][amount] : 0,
                transform: playing ? 'none' : 'scale(0.6)',
                transition: `opacity .35s ease ${index * 16}ms, transform .35s ease ${index * 16}ms`
              }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '9px' }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: ink.strong }}>18 days logged</Typography>
          <Typography sx={{ fontSize: 10, color: ink.muted }}>6 places</Typography>
        </Box>
      </Box>

      <Box sx={{ ...cardSx, mt: '10px', p: '0', overflow: 'hidden', ...reveal(playing, 160) }}>
        <Box sx={{ position: 'relative', height: MAP.height }}>
          {/* A map, in the sense that matters here: water, parks, a few streets
              and the line between the places. */}
          <Box component="svg" viewBox={`0 0 ${MAP.width} ${MAP.height}`} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <rect x="0" y="0" width={MAP.width} height={MAP.height} fill="#eef2f6" />
            <path d="M0,146 Q70,134 138,148 Q210,162 276,146 L276,168 L0,168 Z" fill="#bfdbfe" />
            <circle cx="64" cy="46" r="30" fill="#d9f0dc" />
            <circle cx="222" cy="118" r="24" fill="#d9f0dc" />
            {[34, 82, 130].map((y) => (
              <line key={y} x1="0" x2={MAP.width} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="6" />
            ))}
            {[72, 152, 228].map((x) => (
              <line key={x} x1={x} x2={x} y1="0" y2={MAP.height} stroke="#e2e8f0" strokeWidth="6" />
            ))}
            <path
              d={ROUTE}
              fill="none"
              stroke={moduleAccent.journal}
              strokeWidth="2.4"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={playing ? 0 : 1}
              style={{ transition: 'stroke-dashoffset 1.8s ease .3s' }}
            />
            {PINS.map((pin, index) => (
              <circle
                key={`${pin.x}-${pin.y}`}
                cx={pin.x}
                cy={pin.y}
                r="3.6"
                fill="#fff"
                stroke={moduleAccent.journal}
                strokeWidth="2.4"
                opacity={playing ? 1 : 0}
                style={{ transition: `opacity .3s ease ${400 + index * 420}ms` }}
              />
            ))}
          </Box>
          <Box
            sx={{
              position: 'absolute',
              left: '10px',
              top: '9px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              px: '7px',
              py: '3px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.9)'
            }}
          >
            <PlaceIcon sx={{ fontSize: 11, color: moduleAccent.journal }} />
            <Typography sx={{ fontSize: 9.5, fontWeight: 600, color: ink.strong }}>Tallinn to Nice</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ ...cardSx, mt: '10px', ...reveal(playing, 300) }}>
        {ENTRIES.map((entry) => (
          <Box key={entry.title} sx={{ display: 'flex', alignItems: 'center', gap: '7px', py: '4px' }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: moduleAccent.journal, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: ink.strong, flexGrow: 1, minWidth: 0 }}>
              {entry.title}
            </Typography>
            <Typography sx={{ fontSize: 9, color: ink.muted, flexShrink: 0 }}>{entry.meta}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: '6px', mt: '10px', ...reveal(playing, 420) }}>
        {TOP_TYPES.map((type) => (
          <Box
            key={type.name}
            sx={{
              flex: 1,
              px: '8px',
              py: '7px',
              borderRadius: '10px',
              textAlign: 'center',
              background: 'rgba(225,29,72,0.08)'
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: moduleAccent.journal }}>{type.count}</Typography>
            <Typography sx={{ fontSize: 8.5, color: ink.muted }}>{type.name}</Typography>
          </Box>
        ))}
      </Box>

      <TabBar active="journal" />
    </Screen>
  );
}
