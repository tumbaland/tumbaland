import { Box, Paper, Typography } from '@mui/material';
import AlbumIcon from '@mui/icons-material/PhotoAlbum';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import GroupsIcon from '@mui/icons-material/Groups';
import { SectionHeading } from './SectionHeading';
import { glassInteractive, ink } from '../../theme/tokens';

interface Product {
  key: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ sx?: object }>;
  headline: string;
  /** One sentence: what is in it. */
  lede: string;
}

/** Names, colours and order match config/apps.ts, so the nav after sign-in matches the page. */
export const PRODUCTS: Product[] = [
  {
    key: 'relationship',
    name: 'Journal',
    color: '#ef4444',
    icon: FavoriteIcon,
    headline: 'Where your time went',
    lede: 'What you did and where, with maps, streaks and monthly totals.'
  },
  {
    key: 'album',
    name: 'Album',
    color: '#3b82f6',
    icon: AlbumIcon,
    headline: 'Photos you can find',
    lede: 'Albums, tags, search and collages, and this day in years past.'
  },
  {
    key: 'finance',
    name: 'Money',
    color: '#22c55e',
    icon: AttachMoneyIcon,
    headline: 'Every account in one number',
    lede: 'Net worth, cash flow and investments, with bank statement import.'
  },
  {
    key: 'groups',
    name: 'Groups',
    color: '#7c3aed',
    icon: GroupsIcon,
    headline: 'Share when you want to',
    lede: 'An album, a budget or a journal, with up to five people.'
  }
];

/**
 * The four modules as tiles: two across on a phone, four across on a desktop.
 *
 * They were tall cards with a bullet list each, stacked one per screen on a
 * phone, so four modules took three screens of scrolling. A name, a headline
 * and one sentence say the same in a quarter of the space.
 */
export function ProductsSection() {
  return (
    <Box component="section" id="modules" sx={{ maxWidth: 1120, mx: 'auto', px: 2, py: { xs: 4, md: 7 }, scrollMarginTop: 72 }}>
      <SectionHeading
        eyebrow="What is in it"
        title="Four things, one login"
        subtitle="Your journal, your photos and your money, and the people you share them with."
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 1.25, md: 2 }
        }}
      >
        {PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <Paper
              key={product.key}
              elevation={0}
              sx={{
                ...glassInteractive(product.color),
                p: { xs: 1.75, md: 2.5 },
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 0.75, md: 1 }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: { xs: 28, md: 34 },
                    height: { xs: 28, md: 34 },
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: `${product.color}18`,
                    color: product.color,
                    flexShrink: 0
                  }}
                >
                  <Icon sx={{ fontSize: { xs: 16, md: 19 } }} />
                </Box>
                <Typography
                  sx={{
                    fontSize: { xs: 10.5, md: 11 },
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
                sx={{
                  fontSize: { xs: '0.98rem', md: '1.1rem' },
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: ink.strong,
                  letterSpacing: '-0.015em'
                }}
              >
                {product.headline}
              </Typography>

              <Typography sx={{ color: ink.body, fontSize: { xs: '0.82rem', md: '0.93rem' }, lineHeight: 1.45 }}>
                {product.lede}
              </Typography>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

export default ProductsSection;
