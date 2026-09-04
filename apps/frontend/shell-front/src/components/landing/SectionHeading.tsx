import { Box, Typography } from '@mui/material';
import { brand, ink } from '../../theme/tokens';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

export function SectionHeading({ title, subtitle, eyebrow }: SectionHeadingProps) {
  return (
    <Box sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto', mb: { xs: 4, md: 5 } }}>
      {eyebrow && (
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
          {eyebrow}
        </Typography>
      )}
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: '1.65rem', md: '2.1rem' },
          fontWeight: 750,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          color: ink.strong,
          textWrap: 'balance',
          mb: subtitle ? 1.75 : 0
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: '1.02rem', lineHeight: 1.6, color: ink.body }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default SectionHeading;
