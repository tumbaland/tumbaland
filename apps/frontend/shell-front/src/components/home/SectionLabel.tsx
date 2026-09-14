import { Typography } from '@mui/material';
import { ink } from '../../theme/tokens';

interface SectionLabelProps {
  id?: string;
  children: React.ReactNode;
}

/** The small caption over a group of rows, the way a phone's settings screens label theirs. */
export function SectionLabel({ id, children }: SectionLabelProps) {
  return (
    <Typography
      id={id}
      component="h2"
      sx={{
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: ink.muted,
        px: 0.5,
        mb: 1
      }}
    >
      {children}
    </Typography>
  );
}

export default SectionLabel;
