import { Box, Link, Typography } from '@mui/material';
import { brand, ink } from '../../theme/tokens';
import LockIcon from '@mui/icons-material/Lock';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import DownloadIcon from '@mui/icons-material/Download';
import CodeIcon from '@mui/icons-material/Code';

interface Assurance {
  key: string;
  icon: React.ComponentType<{ sx?: object }>;
  title: string;
  body: React.ReactNode;
}

/**
 * The objection this product has to answer before anything else: it is being
 * asked to hold photos, bank balances and a personal journal. Every claim here
 * is one the codebase actually keeps — Google-only sign-in with no password
 * store, group-scoped access, CSV export in the journal and cash flow views,
 * and a public repository.
 */
const ASSURANCES: Assurance[] = [
  {
    key: 'private',
    icon: GroupOffIcon,
    title: 'Private until you share',
    body: 'Nothing is visible to anyone unless you create a group and invite them.'
  },
  {
    key: 'password',
    icon: LockIcon,
    title: 'No password to leak',
    body: 'Sign-in goes through Google; Tumbaland never stores a password.'
  },
  {
    key: 'export',
    icon: DownloadIcon,
    title: 'Your data comes back out',
    body: 'CSV exports and full-resolution downloads work for everyone, supporter or not.'
  },
  {
    key: 'open',
    icon: CodeIcon,
    title: 'Open source',
    body: (
      <>
        Every line is on{' '}
        <Link
          href="https://github.com/toomastahves/tumbaland"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: '#7c3aed', fontWeight: 600, textUnderlineOffset: 2 }}
        >
          GitHub
        </Link>
        . Read it, or run it yourself.
      </>
    )
  }
];

export function PrivacySection() {
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 5, md: 7 },
        px: { xs: 2.5, md: 5 },
        mx: { xs: 1, md: 2 },
        my: { xs: 2, md: 4 },
        borderRadius: { xs: 4, md: 6 },
        // Tinted glass rather than the near-black band it replaces: it still
        // reads as its own section against the white cards either side, without
        // dropping a hard dark rectangle into a pastel page.
        background: 'linear-gradient(150deg, rgba(236,222,255,0.72) 0%, rgba(255,225,247,0.62) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.75)',
        boxShadow: '0 18px 44px -30px rgba(124,58,237,0.55)',
        color: ink.strong
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: 620, mx: 'auto', mb: { xs: 4, md: 5 } }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: brand.purple,
            mb: 1.5
          }}
        >
          Privacy
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.6rem', md: '2.05rem' },
            fontWeight: 750,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textWrap: 'balance',
            mb: 1.5
          }}
        >
          Before you hand it anything
        </Typography>
        <Typography sx={{ fontSize: '1.02rem', lineHeight: 1.6, color: ink.body }}>
          A product that asks for your photos, your balance sheet, and your diary owes you straight
          answers.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: { xs: 2.5, md: 3.5 },
          maxWidth: 860,
          mx: 'auto'
        }}
      >
        {ASSURANCES.map((item) => {
          const Icon = item.icon;
          return (
            <Box key={item.key} sx={{ display: 'flex', gap: 1.75 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'rgba(147,51,234,0.12)',
                  color: '#7c3aed'
                }}
              >
                <Icon sx={{ fontSize: 19 }} />
              </Box>
              <Box>
                <Typography
                  component="h3"
                  sx={{ fontSize: '1.02rem', fontWeight: 700, mb: 0.5, color: ink.strong }}
                >
                  {item.title}
                </Typography>
                <Typography sx={{ fontSize: '0.93rem', lineHeight: 1.62, color: ink.body }}>
                  {item.body}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default PrivacySection;
