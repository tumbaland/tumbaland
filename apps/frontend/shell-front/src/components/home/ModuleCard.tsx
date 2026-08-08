import { Box, Button, Card, CardActionArea, Typography } from '@mui/material';
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
      sx={{
        borderRadius: 3.5,
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 10px 30px -22px rgba(31,38,135,0.5)',
        transition: 'transform .2s ease, box-shadow .2s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: `0 20px 38px -24px ${module.color}cc`
        }
      }}
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
            sx={{ fontSize: '1.12rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.015em' }}
          >
            {module.name}
          </Typography>
          <ArrowForwardIcon sx={{ ml: 'auto', fontSize: 18, color: '#94a3b8' }} />
        </Box>

        <Typography sx={{ color: '#475569', fontSize: '0.93rem', lineHeight: 1.55 }}>
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
