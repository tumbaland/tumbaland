import { Box, Button, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import DownloadIcon from '@mui/icons-material/Download';
import { brand, ink } from '@tumbaland/frontend-core';
import type { DocumentKey } from './DocumentDialog';

interface Assurance {
  key: string;
  icon: React.ComponentType<{ sx?: object }>;
  title: string;
  body: string;
}

/**
 * The objection this product has to answer before anything else: it is being
 * asked to hold photos, private messages and a personal journal. Every claim here
 * is one the codebase actually keeps: Google-only sign-in with no password
 * store, group-scoped access, and CSV and full-resolution exports.
 */
const ASSURANCES: Assurance[] = [
  {
    key: 'private',
    icon: GroupOffIcon,
    title: 'Only your group',
    body: 'Nobody sees anything until you invite them.'
  },
  {
    key: 'password',
    icon: LockIcon,
    title: 'Google sign-in',
    body: 'You sign in with Google. Tumbaland does not store passwords.'
  },
  {
    key: 'export',
    icon: DownloadIcon,
    title: 'Export any time',
    body: 'Download your data as CSV and your photos at full size.'
  }
];

interface PrivacySectionProps {
  /** Opens the privacy policy or the terms over the page. */
  onOpen: (doc: Extract<DocumentKey, 'privacy' | 'terms'>) => void;
}

/** Document buttons carry a real address, so they work opened in a new tab too. */
const DOCUMENT_LINKS: Array<{ doc: Extract<DocumentKey, 'privacy' | 'terms'>; href: string; label: string }> = [
  { doc: 'privacy', href: '/privacy', label: 'Privacy policy' },
  { doc: 'terms', href: '/terms', label: 'Terms' }
];

export function PrivacySection({ onOpen }: PrivacySectionProps) {
  return (
    <Box component="section" id="privacy" sx={{ maxWidth: 1120, mx: 'auto', px: 2, py: { xs: 2, md: 4 }, scrollMarginTop: 72 }}>
      <Box
        sx={{
          maxWidth: 1000,
          mx: 'auto',
          px: { xs: 2.25, md: 5 },
          py: { xs: 3, md: 5.5 },
          borderRadius: { xs: 4, md: 6 },
          // Tinted glass: it reads as its own section against the white cards
          // either side without dropping a hard dark band into a pastel page.
          background: 'linear-gradient(150deg, rgba(236,222,255,0.72) 0%, rgba(255,225,247,0.62) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: '0 18px 44px -30px rgba(124,58,237,0.55)',
          color: ink.strong
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 620, mx: 'auto', mb: { xs: 2.5, md: 4.5 } }}>
          <Typography
            sx={{
              fontSize: { xs: 11, md: 12 },
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: brand.purple,
              mb: { xs: 1, md: 1.5 }
            }}
          >
            Privacy
          </Typography>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.45rem', md: '2.05rem' },
              fontWeight: 750,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              textWrap: 'balance',
              mb: { xs: 1, md: 1.5 }
            }}
          >
            How your data is kept
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.02rem' }, lineHeight: 1.55, color: ink.body }}>
            It holds your photos, messages and journal, so here is what happens to them.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 2, md: 3.5 }
          }}
        >
          {ASSURANCES.map((item) => {
            const Icon = item.icon;
            return (
              <Box key={item.key} sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: 'rgba(147,51,234,0.12)',
                    color: '#7c3aed'
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h3" sx={{ fontSize: { xs: '0.96rem', md: '1.02rem' }, fontWeight: 700, mb: 0.25, color: ink.strong }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.88rem', md: '0.93rem' }, lineHeight: 1.5, color: ink.body }}>
                    {item.body}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: { xs: 2.5, md: 4 } }}>
          {DOCUMENT_LINKS.map((link) => (
            <Button
              key={link.doc}
              href={link.href}
              onClick={(event) => {
                event.preventDefault();
                onOpen(link.doc);
              }}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 3,
                px: 2.25,
                color: brand.purple,
                borderColor: `${brand.purple}55`,
                backgroundColor: 'rgba(255,255,255,0.5)',
                '&:hover': { borderColor: brand.purple, backgroundColor: `${brand.purple}12` }
              }}
            >
              {link.label}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default PrivacySection;
