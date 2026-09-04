import { Box, Button, Card, CardActionArea, Typography } from '@mui/material';
import { glassInteractive, ink } from '../../theme/tokens';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { HomeModule } from './modules';

interface ModuleCardProps {
  module: HomeModule;
  onOpen: (route: string) => void;
}

export function ModuleCard({ module, onOpen }: ModuleCardProps) {
  const Icon = module.icon;

  return (
    <Card
      elevation={0}
      // The module's own colour tints the lifted shadow, so each card lights up
      // in its own hue rather than all four in the same purple.
      sx={glassInteractive(module.color)}
    >
      <CardActionArea
        onClick={() => onOpen(module.route)}
        aria-label={`Open ${module.name}`}
        sx={{ p: { xs: 2.25, md: 2.75 }, pb: 1.5, display: 'block' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: `${module.color}1f`,
              color: module.color,
              flexShrink: 0
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
          </Box>
          <Typography
            component="h2"
            sx={{ fontSize: '1.12rem', fontWeight: 700, color: ink.strong, letterSpacing: '-0.015em' }}
          >
            {module.name}
          </Typography>
          <ArrowForwardIcon sx={{ ml: 'auto', fontSize: 18, color: ink.faint }} />
        </Box>

        <Typography sx={{ color: ink.body, fontSize: '0.93rem', lineHeight: 1.55 }}>
          {module.description}
        </Typography>
      </CardActionArea>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: { xs: 2.25, md: 2.75 }, pb: 2.25 }}>
        {module.actions.map((action) => (
          <Button
            key={action.route}
            size="small"
            onClick={() => onOpen(action.route)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              borderRadius: 2,
              px: 1.5,
              py: 0.4,
              color: module.color,
              backgroundColor: `${module.color}14`,
              '&:hover': { backgroundColor: `${module.color}26` }
            }}
          >
            {action.label}
          </Button>
        ))}
      </Box>
    </Card>
  );
}

export default ModuleCard;
