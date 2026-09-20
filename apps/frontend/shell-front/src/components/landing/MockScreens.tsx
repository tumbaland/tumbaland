import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PhotoAlbumIcon from '@mui/icons-material/PhotoAlbum';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { ink, moduleAccent } from '@tumbaland/frontend-core';
import { PhotoTile } from './PhotoTile';

/**
 * The three screens the showcase shows: a month of the journal, the money, and
 * the album. They are the app's own layout and the app's own module colours,
 * drawn at PhoneFrame's fixed canvas size and filled with sample data.
 *
 * Drawn rather than photographed because the only real screens Tumbaland has
 * are somebody's evenings, somebody's bank balance and somebody's holiday, and
 * none of that belongs on a public page. The sample data is plausible and it
 * is labelled as sample under the phones.
 *
 * Each screen animates once, when it first comes into view, and is passed
 * `playing` rather than owning that: three screens sharing one observer land
 * together instead of trickling in as each crosses the line.
 */

/** One reveal, `delay` ms into the sequence. */
const reveal = (playing: boolean, delay: number): SxProps<Theme> => ({
  opacity: playing ? 1 : 0,
  transform: playing ? 'none' : 'translateY(10px)',
  transition: `opacity .5s ease ${delay}ms, transform .5s ease ${delay}ms`
});

const cardSx = {
  background: 'rgba(255,255,255,0.86)',
  border: '1px solid rgba(255,255,255,0.95)',
  borderRadius: '14px',
  boxShadow: '0 10px 24px -20px rgba(31,38,135,0.7)',
  p: '11px 12px'
} as const;

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: '12px', pt: '18px', pb: 0 }}>
      {children}
    </Box>
  );
}

function ScreenHeader({ title, sub, accent }: { title: string; sub: string; accent: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '7px', mb: '10px', px: '2px' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: ink.strong }}>{title}</Typography>
      <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: accent }}>{sub}</Typography>
    </Box>
  );
}

/** The app's own tab bar, in its order and its module colours. */
const TABS = [
  { key: 'home', icon: HomeIcon, label: 'Home', color: moduleAccent.home },
  { key: 'journal', icon: FavoriteIcon, label: 'Journal', color: moduleAccent.journal },
  { key: 'album', icon: PhotoAlbumIcon, label: 'Album', color: moduleAccent.album },
  { key: 'money', icon: AttachMoneyIcon, label: 'Money', color: moduleAccent.money }
] as const;

/** Half of what makes a card read as a screen rather than a card. */
function TabBar({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <Box
      sx={{
        mt: 'auto',
        mx: '-12px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        pt: '8px',
        pb: '12px',
        background: 'rgba(253,244,250,0.72)',
        backdropFilter: 'blur(16px) saturate(165%)',
        borderTop: '1px solid rgba(124,58,237,0.10)'
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const on = tab.key === active;
        const color = on ? tab.color : ink.faint;
        return (
          <Box key={tab.key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Icon sx={{ fontSize: 15, color }} />
            <Typography sx={{ fontSize: 8, fontWeight: on ? 700 : 500, color }}>{tab.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/* ------------------------------- Journal -------------------------------- */

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

/* -------------------------------- Money --------------------------------- */

/** Twelve months of net worth, in thousands. Illustrative. */
const NET_WORTH = [39.2, 39.8, 40.6, 40.1, 41.4, 42.6, 43.2, 44.1, 45.4, 46.1, 47.2, 48.2];

const CATEGORIES = [
  { name: 'Groceries', amount: 412 },
  { name: 'Restaurants', amount: 181 },
  { name: 'Transport', amount: 96 }
];

/** What the net worth is made of. Illustrative. */
const HOLDINGS = [
  { name: 'Index funds', value: '21,400', change: '+1.8%', up: true },
  { name: 'Savings', value: '18,610', change: '+0.3%', up: true },
  { name: 'Current accounts', value: '8,200', change: '-2.1%', up: false }
];

const PLOT = { width: 252, height: 84 };

/** The net worth line, and the area under it. */
function netWorthPath(): { line: string; area: string } {
  const low = Math.min(...NET_WORTH) - 1.5;
  const high = Math.max(...NET_WORTH) + 0.8;
  const points = NET_WORTH.map((value, index) => {
    const x = (index / (NET_WORTH.length - 1)) * PLOT.width;
    const y = PLOT.height - ((value - low) / (high - low)) * PLOT.height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return {
    line: `M${points.join(' L')}`,
    area: `M0,${PLOT.height} L${points.join(' L')} L${PLOT.width},${PLOT.height} Z`
  };
}

export function MoneyScreen({ playing }: { playing: boolean }) {
  const { line, area } = netWorthPath();
  const peak = Math.max(...CATEGORIES.map((category) => category.amount));

  return (
    <Screen>
      <ScreenHeader title="Money" sub="Net worth" accent={moduleAccent.money} />

      <Box sx={{ ...cardSx, ...reveal(playing, 0) }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: ink.strong }}>48,210</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: ink.muted }}>EUR</Typography>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: '3px', px: '6px', py: '2px', borderRadius: '999px', background: 'rgba(21,128,61,0.10)' }}>
            <TrendingUpIcon sx={{ fontSize: 11, color: moduleAccent.money }} />
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: moduleAccent.money }}>2.4%</Typography>
          </Box>
        </Box>

        <Box component="svg" viewBox={`0 0 ${PLOT.width} ${PLOT.height}`} sx={{ display: 'block', width: '100%', height: 'auto', mt: '8px' }}>
          <path d={area} fill="rgba(21,128,61,0.12)" opacity={playing ? 1 : 0} style={{ transition: 'opacity .8s ease .9s' }} />
          <path
            d={line}
            fill="none"
            stroke={moduleAccent.money}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={playing ? 0 : 1}
            style={{ transition: 'stroke-dashoffset 1.6s ease .2s' }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '3px' }}>
          {['Oct', 'Mar', 'Sep'].map((month) => (
            <Typography key={month} sx={{ fontSize: 8.5, color: ink.muted }}>
              {month}
            </Typography>
          ))}
        </Box>
      </Box>

      <Box sx={{ ...cardSx, mt: '10px', ...reveal(playing, 160) }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: '8px' }}>
          This month
        </Typography>
        {CATEGORIES.map((category, index) => (
          <Box key={category.name} sx={{ mb: index === CATEGORIES.length - 1 ? 0 : '9px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '4px' }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: ink.strong }}>{category.name}</Typography>
              <Typography sx={{ fontSize: 10.5, color: ink.body }}>{category.amount}</Typography>
            </Box>
            <Box sx={{ height: 5, borderRadius: '999px', background: 'rgba(15,23,42,0.06)', overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  borderRadius: '999px',
                  background: moduleAccent.money,
                  width: playing ? `${(category.amount / peak) * 100}%` : 0,
                  transition: `width .9s cubic-bezier(.22,.61,.36,1) ${400 + index * 130}ms`
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ ...cardSx, mt: '10px', ...reveal(playing, 300) }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {[
            { label: 'In', value: '2,140' },
            { label: 'Out', value: '1,612' },
            { label: 'Saved', value: '528' }
          ].map((figure) => (
            <Box key={figure.label}>
              <Typography sx={{ fontSize: 9, color: ink.muted }}>{figure.label}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: ink.strong }}>{figure.value}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ ...cardSx, mt: '10px', ...reveal(playing, 420) }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: '8px' }}>
          Accounts
        </Typography>
        {HOLDINGS.map((holding, index) => (
          <Box key={holding.name} sx={{ display: 'flex', alignItems: 'center', gap: '8px', mt: index === 0 ? 0 : '7px' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: ink.strong, flexGrow: 1, minWidth: 0 }}>
              {holding.name}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: ink.body }}>{holding.value}</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, width: 32, textAlign: 'right', color: holding.up ? moduleAccent.money : '#b91c1c' }}>
              {holding.change}
            </Typography>
          </Box>
        ))}
      </Box>

      <TabBar active="money" />
    </Screen>
  );
}

/* -------------------------------- Album --------------------------------- */

const STRIP = ['snow', 'forest', 'city', 'garden'] as const;

const ALBUMS = [
  { name: 'Nice 2025', count: '148 photos', scene: 'coast' as const },
  { name: 'Midsummer', count: '92 photos', scene: 'garden' as const },
  { name: 'Lapland', count: '64 photos', scene: 'snow' as const },
  { name: 'Weekends', count: '212 photos', scene: 'forest' as const }
];

/** Tags are how a photo is found again, so the screen shows some. */
const TAGS = ['Nice', 'Summer', 'Us two', 'Sea'];

export function AlbumScreen({ playing }: { playing: boolean }) {
  return (
    <Screen>
      <ScreenHeader title="Album" sub="A year ago today" accent={moduleAccent.album} />

      <Box sx={{ position: 'relative', ...reveal(playing, 0) }}>
        <PhotoTile scene="coast" radius={14} sx={{ width: '100%', height: 168 }} />
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            px: '11px',
            pt: '22px',
            pb: '10px',
            borderRadius: '0 0 14px 14px',
            background: 'linear-gradient(to top, rgba(15,23,42,0.6), rgba(15,23,42,0))'
          }}
        >
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>Nice, 12 September</Typography>
          <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>9 photos that day</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: '6px', mt: '8px' }}>
        {STRIP.map((scene, index) => (
          <PhotoTile
            key={scene}
            scene={scene}
            radius={9}
            sx={{
              flex: 1,
              aspectRatio: '1 / 1',
              opacity: playing ? 1 : 0,
              transform: playing ? 'none' : 'scale(0.86)',
              transition: `opacity .4s ease ${200 + index * 110}ms, transform .4s ease ${200 + index * 110}ms`
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '5px', mt: '9px', ...reveal(playing, 360) }}>
        {TAGS.map((tag) => (
          <Typography
            key={tag}
            sx={{
              px: '8px',
              py: '3px',
              borderRadius: '999px',
              fontSize: 9,
              fontWeight: 600,
              color: moduleAccent.album,
              background: 'rgba(37,99,235,0.10)'
            }}
          >
            {tag}
          </Typography>
        ))}
      </Box>

      <Box sx={{ ...cardSx, mt: '9px', ...reveal(playing, 460) }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.muted, mb: '8px' }}>
          Albums
        </Typography>
        {ALBUMS.map((album, index) => (
          <Box key={album.name} sx={{ display: 'flex', alignItems: 'center', gap: '9px', mt: index === 0 ? 0 : '8px' }}>
            <PhotoTile scene={album.scene} radius={7} sx={{ width: 34, height: 34, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: ink.strong }}>{album.name}</Typography>
              <Typography sx={{ fontSize: 9, color: ink.muted }}>{album.count}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <TabBar active="album" />
    </Screen>
  );
}
