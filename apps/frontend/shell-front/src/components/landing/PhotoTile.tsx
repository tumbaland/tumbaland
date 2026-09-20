import { useId } from 'react';
import { Box } from '@mui/material';

/**
 * A stand-in for a photo.
 *
 * The album screens need pictures in them, and the only real ones Tumbaland
 * has are somebody's. Rather than putting a stranger's holiday on a public
 * page, or a stock photo pretending to be one, each tile is a drawn scene:
 * obviously an illustration at a glance, and it costs a few hundred bytes
 * instead of a download.
 */

export type PhotoScene = 'coast' | 'forest' | 'city' | 'snow' | 'garden' | 'desert';

interface Scene {
  /** Sky, top to bottom. */
  sky: [string, string];
  /** Sun or moon: position and colour. */
  light: { x: number; y: number; r: number; fill: string };
  /** Back and front landforms, painted in that order. */
  layers: { d: string; fill: string }[];
  /** Anything the scene needs on top: trees, buildings, a jetty. */
  extras?: { d: string; fill: string }[];
}

const HILL_BACK = 'M0,58 Q26,44 52,56 Q76,66 100,50 L100,100 L0,100 Z';
const HILL_FRONT = 'M0,76 Q30,62 58,74 Q80,83 100,68 L100,100 L0,100 Z';
const WAVE_BACK = 'M0,60 Q25,54 50,60 Q75,66 100,60 L100,100 L0,100 Z';
const WAVE_FRONT = 'M0,78 Q25,72 50,78 Q75,84 100,78 L100,100 L0,100 Z';

const SCENES: Record<PhotoScene, Scene> = {
  coast: {
    sky: ['#7dd3fc', '#fbcfe8'],
    light: { x: 74, y: 26, r: 11, fill: 'rgba(255,255,255,0.85)' },
    layers: [
      { d: WAVE_BACK, fill: '#38bdf8' },
      { d: WAVE_FRONT, fill: '#0ea5e9' }
    ],
    extras: [{ d: 'M0,92 Q30,86 60,92 Q80,96 100,92 L100,100 L0,100 Z', fill: '#fde68a' }]
  },
  forest: {
    sky: ['#bbf7d0', '#fef9c3'],
    light: { x: 24, y: 22, r: 9, fill: 'rgba(255,255,255,0.8)' },
    layers: [
      { d: HILL_BACK, fill: '#4ade80' },
      { d: HILL_FRONT, fill: '#16a34a' }
    ],
    extras: [
      { d: 'M22,86 L30,58 L38,86 Z', fill: '#166534' },
      { d: 'M58,90 L68,54 L78,90 Z', fill: '#15803d' }
    ]
  },
  city: {
    sky: ['#312e81', '#db2777'],
    light: { x: 70, y: 22, r: 7, fill: 'rgba(255,255,255,0.9)' },
    layers: [{ d: 'M0,70 L100,70 L100,100 L0,100 Z', fill: '#1e1b4b' }],
    extras: [
      { d: 'M8,100 L8,58 L24,58 L24,100 Z', fill: '#312e81' },
      { d: 'M30,100 L30,44 L46,44 L46,100 Z', fill: '#3730a3' },
      { d: 'M52,100 L52,62 L66,62 L66,100 Z', fill: '#312e81' },
      { d: 'M72,100 L72,50 L90,50 L90,100 Z', fill: '#4338ca' }
    ]
  },
  snow: {
    sky: ['#e0f2fe', '#c7d2fe'],
    light: { x: 78, y: 24, r: 8, fill: 'rgba(255,255,255,0.95)' },
    layers: [
      { d: 'M0,66 L28,36 L52,66 L72,48 L100,74 L100,100 L0,100 Z', fill: '#94a3b8' },
      { d: 'M0,82 Q30,70 58,80 Q80,88 100,76 L100,100 L0,100 Z', fill: '#f8fafc' }
    ]
  },
  garden: {
    sky: ['#fbcfe8', '#fef3c7'],
    light: { x: 30, y: 24, r: 10, fill: 'rgba(255,255,255,0.8)' },
    layers: [
      { d: HILL_BACK, fill: '#86efac' },
      { d: HILL_FRONT, fill: '#22c55e' }
    ],
    extras: [
      { d: 'M18,84 a5,5 0 1,1 0.1,0 Z', fill: '#f472b6' },
      { d: 'M44,90 a4,4 0 1,1 0.1,0 Z', fill: '#fb7185' },
      { d: 'M74,86 a5,5 0 1,1 0.1,0 Z', fill: '#e879f9' }
    ]
  },
  desert: {
    sky: ['#fed7aa', '#fca5a5'],
    light: { x: 62, y: 30, r: 13, fill: 'rgba(255,255,255,0.75)' },
    layers: [
      { d: 'M0,72 Q30,58 56,70 Q80,80 100,66 L100,100 L0,100 Z', fill: '#f59e0b' },
      { d: 'M0,86 Q34,76 62,86 Q84,92 100,84 L100,100 L0,100 Z', fill: '#d97706' }
    ]
  }
};

interface PhotoTileProps {
  scene: PhotoScene;
  /** Corner radius, in the screen's own pixels. */
  radius?: number;
  sx?: Record<string, unknown>;
}

export function PhotoTile({ scene, radius = 10, sx }: PhotoTileProps) {
  const gradientId = `${useId()}-sky`;
  const { sky, light, layers, extras = [] } = SCENES[scene];

  return (
    <Box
      aria-hidden
      sx={{ position: 'relative', overflow: 'hidden', borderRadius: `${radius}px`, lineHeight: 0, ...sx }}
    >
      <Box
        component="svg"
        viewBox="0 0 100 100"
        // Filled like a photo in a frame: cropped rather than stretched, so a
        // wide tile and a square one show the same scene undistorted.
        preserveAspectRatio="xMidYMid slice"
        sx={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky[0]} />
            <stop offset="100%" stopColor={sky[1]} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        <circle cx={light.x} cy={light.y} r={light.r} fill={light.fill} />
        {[...layers, ...extras].map((shape) => (
          <path key={shape.d} d={shape.d} fill={shape.fill} />
        ))}
      </Box>
    </Box>
  );
}

export default PhotoTile;
