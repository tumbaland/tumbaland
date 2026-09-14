import { Box, Typography } from '@mui/material';
import { brand, ink } from '../../theme/tokens';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

/** Sized for a phone first: at desktop sizes a heading and its gap took a third of the screen. */
export function SectionHeading({ title, subtitle, eyebrow }: SectionHeadingProps) {
  return (
    <Box sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto', mb: { xs: 2.5, md: 5 } }}>
      {eyebrow && (
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
          {eyebrow}
        </Typography>
      )}
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: '1.45rem', md: '2.1rem' },
          fontWeight: 750,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          color: ink.strong,
          textWrap: 'balance',
          mb: subtitle ? { xs: 1, md: 1.75 } : 0
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.02rem' }, lineHeight: 1.55, color: ink.body }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default SectionHeading;
