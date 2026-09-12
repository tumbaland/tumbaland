import { Box, Paper, Typography } from '@mui/material';
import { ink } from '../../theme/tokens';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import GroupsIcon from '@mui/icons-material/Groups';
import { SectionHeading } from './SectionHeading';

interface Product {
  key: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ sx?: object }>;
  headline: string;
  /** One crisp sentence, before the bullets. */
  lede: string;
  points: string[];
}

/** Names and colours match config/apps.ts, so the nav after sign-in matches the ad. */
export const PRODUCTS: Product[] = [
  {
    key: 'album',
    name: 'Album',
    color: '#3b82f6',
    icon: AlbumIcon,
    headline: 'Photos you can actually find',
    lede: 'Search and tag your photos, and make collages that export at full resolution.',
    points: ['Albums, tags and search', 'Photos from this day in past years', 'Collages that export print-ready']
  },
  {
    key: 'finance',
    name: 'Finance',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    headline: 'Every account in one number',
    lede: 'Net worth over time, holdings and trades, live prices, and statement import.',
    points: ['Net worth and cash flow over time', 'Holdings, trades and live prices', 'Import bank statements']
  },
  {
    key: 'relationship',
    name: 'Relationship',
    color: '#ef4444',
    icon: FavoriteIcon,
    headline: 'Where your time went',
    lede: 'Journal entries with maps, heatmaps, and monthly totals. Export anytime.',
    points: ['Journal what you did and where', 'Maps, heatmaps and monthly totals', 'Export to CSV whenever']
  },
  {
    key: 'groups',
    name: 'Groups',
    color: '#7c3aed',
    icon: GroupsIcon,
    headline: 'Optional, and off by default',
    lede: 'Share an album, a budget, or a journal. Up to five people, never priced per head.',
    points: ['Nothing is shared until you invite someone', 'Everyone sees the same history', 'Up to five people, never priced per head']
  }
];

export function ProductsSection() {
  return (
    <Box component="section" id="modules" sx={{ py: { xs: 5, md: 7 }, px: 2, scrollMarginTop: 80 }}>
      <SectionHeading
        eyebrow="What you get"
        title="Four things worth tracking, finally in one login"
        subtitle="Most people pay for four separate apps that cannot talk to each other."
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          maxWidth: 940,
          mx: 'auto'
        }}
      >
        {PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <Paper
              key={product.key}
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3.5,
                // Same glass treatment as the signed-in home's module cards.
                background: 'rgba(255,255,255,0.62)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.7)',
                boxShadow: '0 10px 30px -22px rgba(31,38,135,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                transition: 'transform .2s ease, box-shadow .2s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: `0 18px 34px -22px ${product.color}bb`
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: `${product.color}18`,
                    color: product.color,
                    flexShrink: 0
                  }}
                >
                  <Icon sx={{ fontSize: 19 }} />
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.11em',
                    textTransform: 'uppercase',
                    color: product.color
                  }}
                >
                  {product.name}
                </Typography>
              </Box>

              <Typography
                component="h3"
                sx={{ fontSize: '1.15rem', fontWeight: 700, color: ink.strong, letterSpacing: '-0.015em' }}
              >
                {product.headline}
              </Typography>

              <Typography sx={{ color: '#334155', fontSize: '0.96rem', lineHeight: 1.55 }}>
                {product.lede}
              </Typography>

              <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}>
                {product.points.map((point) => (
                  <Box
                    key={point}
                    component="li"
                    sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', color: ink.body, fontSize: '0.93rem' }}
                  >
                    <Box
                      sx={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: product.color,
                        mt: '8px',
                        flexShrink: 0
                      }}
                    />
                    {point}
                  </Box>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

export default ProductsSection;
