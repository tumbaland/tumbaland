import { Box, ButtonBase, Typography } from '@mui/material';
import { QUICK_ACTIONS } from './modules';
import { brand, glass, ink } from '@tumbaland/components';

interface QuickActionsProps {
  onOpen: (route: string) => void;
}

/**
 * The things people open the app to do, one tap each.
 *
 * On a phone they are a row of coloured squares with a label under each, the
 * layout a phone's own home screen taught everyone. From `md` up the same four
 * sit in cards with the label beside the icon, where a bare icon would be lost
 * in the width.
 */
export function QuickActions({ onOpen }: QuickActionsProps) {
  return (
    <Box
      component="nav"
      aria-label="Quick actions"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: { xs: 1, md: 1.5 }
      }}
    >
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <ButtonBase
            key={action.key}
            onClick={() => onOpen(action.route())}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: { xs: 'flex-start', md: 'flex-start' },
              gap: { xs: 0.75, md: 1.25 },
              minWidth: 0,
              py: { xs: 0.5, md: 1.25 },
              px: { xs: 0, md: 1.5 },
              borderRadius: glass.borderRadius,
              background: { xs: 'transparent', md: glass.background },
              border: { xs: '1px solid transparent', md: glass.border },
              boxShadow: { xs: 'none', md: glass.boxShadow },
              backdropFilter: { xs: 'none', md: glass.backdropFilter },
              WebkitTapHighlightColor: 'transparent',
              '&:active .quick-action-icon': { transform: 'scale(0.93)' },
              '&.Mui-focusVisible .quick-action-icon': { outline: `2px solid ${brand.violet}`, outlineOffset: 2 }
            }}
          >
            <Box
              className="quick-action-icon"
              sx={{
                width: { xs: 56, md: 40 },
                height: { xs: 56, md: 40 },
                borderRadius: { xs: 4, md: 2.5 },
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: '#fff',
                background: `linear-gradient(145deg, ${action.color} 0%, ${action.color}cc 100%)`,
                boxShadow: `0 10px 20px -12px ${action.color}`,
                transition: 'transform .15s ease'
              }}
            >
              <Icon sx={{ fontSize: { xs: 26, md: 21 } }} />
            </Box>
            <Typography
              component="span"
              noWrap
              sx={{
                maxWidth: '100%',
                fontSize: { xs: 12, md: 14.5 },
                fontWeight: 600,
                color: ink.strong
              }}
            >
              {action.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default QuickActions;
