import { Box, ButtonBase, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { HOME_MODULES } from './modules';
import { SectionLabel } from './SectionLabel';
import { glass, ink } from '@tumbaland/components';

interface ModuleListProps {
  onOpen: (route: string) => void;
}

/**
 * Every module as a row in one grouped list: icon, name, a line on what is in
 * it, and a chevron.
 *
 * They were four cards with their own shortcut buttons, one card per screen on
 * a phone. The tab bar already opens each module, so the home page does not need
 * to repeat them at that size; a list says what each is and opens it, in about
 * a third of the height.
 */
export function ModuleList({ onOpen }: ModuleListProps) {
  return (
    <Box component="section" aria-labelledby="home-modules">
      <SectionLabel id="home-modules">Modules</SectionLabel>
      <Box sx={{ ...glass, overflow: 'hidden' }}>
        {HOME_MODULES.map((module, index) => {
          const Icon = module.icon;
          return (
            <ButtonBase
              key={module.key}
              onClick={() => onOpen(module.route)}
              aria-label={`Open ${module.name}`}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 1.5,
                px: { xs: 1.75, md: 2.25 },
                py: { xs: 1.25, md: 1.5 },
                textAlign: 'left',
                borderTop: index === 0 ? 'none' : '1px solid rgba(15,23,42,0.06)',
                WebkitTapHighlightColor: 'transparent',
                '&:hover, &:active': { background: 'rgba(255,255,255,0.5)' }
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  color: module.color,
                  backgroundColor: `${module.color}1f`
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: ink.strong, lineHeight: 1.3 }}>
                  {module.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.86rem', color: ink.body }}>
                  {module.description}
                </Typography>
              </Box>
              <ChevronRightIcon sx={{ color: ink.faint }} />
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export default ModuleList;
