import { Box, ButtonBase, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { HomeModule } from './modules';
import { glass, ink } from '../../theme/tokens';

interface ContinueCardProps {
  module: HomeModule;
  /** The exact page last open, e.g. `/finance/net-worth`, not just the module's front page. */
  route: string;
  onOpen: (route: string) => void;
}

/** "Where was I": back to the page last open, in one tap. */
export function ContinueCard({ module, route, onOpen }: ContinueCardProps) {
  const Icon = module.icon;

  return (
    <ButtonBase
      onClick={() => onOpen(route)}
      aria-label={`Back to ${module.name}`}
      sx={{
        ...glass,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.5,
        px: { xs: 1.75, md: 2.25 },
        py: { xs: 1.25, md: 1.5 },
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        '&:hover': { background: 'rgba(255,255,255,0.75)' }
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: module.color,
          backgroundColor: `${module.color}1f`
        }}
      >
        <Icon sx={{ fontSize: 21 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: ink.muted }}>Continue where you left off</Typography>
        <Typography noWrap sx={{ fontSize: '1.02rem', fontWeight: 700, color: ink.strong }}>
          {module.name}
        </Typography>
      </Box>
      <ChevronRightIcon sx={{ color: ink.faint }} />
    </ButtonBase>
  );
}

export default ContinueCard;
