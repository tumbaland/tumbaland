import { ComponentType, MouseEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { brand, chrome, ink, surface, TOUCH_TARGET } from '../../theme/tokens';

/** One section of a module: a page of it the navigation lists by name. */
export interface SectionBarItem {
  label: string;
  /** Absolute address, the same one in the shell and standalone (see each app's appBase). */
  route: string;
  icon?: ComponentType<SvgIconProps>;
}

export interface SectionBarProps {
  /** The module the sections belong to. Named at the left of the bar. */
  title: string;
  /** Drawn in a tinted tile before the title. */
  icon?: ComponentType<SvgIconProps>;
  /** The module's accent. Tints the tile and the section being shown. */
  accent?: string;
  /** In menu order. A module with one section passes none and gets just a title. */
  items?: SectionBarItem[];
  currentRoute: string;
  /** Phones get one dropdown in place of the row, and no title. */
  compact?: boolean;
  /** Pinned to the right of the bar — where the shell puts the tenant selector. */
  end?: ReactNode;
}

/** A section owns its own path and everything nested under it. */
const isSectionActive = (route: string, currentRoute: string) =>
  currentRoute === route || currentRoute.startsWith(`${route}/`);

/**
 * The one bar above a module's content: what you are in, and where else you can
 * go inside it.
 *
 * It lives here rather than in the shell because a module renders it in both
 * the modes it runs in. Inside the shell one bar is drawn for whichever module
 * is loaded; standalone, the module's own `AppLayout` draws the same bar from
 * the same section list. The alternative — in-page MUI `Tabs` — is what had
 * Profile and Billing looking nothing like Journal, Album and Money, and put a
 * second row of navigation under the shell's own.
 *
 * Sections are laid out in full on a wide screen, since a row of five names is
 * worth more than a button that hides four of them. Below `sm` there is no room
 * for that, so the same list becomes a dropdown labelled with the section being
 * shown.
 */
export function SectionBar({
  title,
  icon: Icon,
  accent = brand.pinkInk,
  items = [],
  currentRoute,
  compact = false,
  end
}: SectionBarProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const close = () => setAnchorEl(null);
  const activeItem = items.find(({ route }) => isSectionActive(route, currentRoute));

  const sections = items.length > 0 && (
    <Box component="nav" aria-label={`${title} sections`} sx={compact ? compactNav : sectionRow}>
      {compact ? (
        <Button
          // No aria-label: the accessible name is the section the button
          // names, which is the thing a reader needs read out. The nav around
          // it already says which module's sections these are.
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
          startIcon={activeItem?.icon ? <activeItem.icon /> : undefined}
          endIcon={<ExpandMoreIcon />}
          sx={{ ...pillBase, ...activePill(accent), maxWidth: '100%', fontSize: 15 }}
        >
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeItem?.label ?? title}
          </Box>
        </Button>
      ) : (
        items.map(({ label, route, icon: ItemIcon }) => {
          const active = isSectionActive(route, currentRoute);
          return (
            <Button
              key={route}
              component={Link}
              to={route}
              aria-current={active ? 'page' : undefined}
              startIcon={ItemIcon ? <ItemIcon /> : undefined}
              sx={{ ...pillBase, ...(active ? activePill(accent) : idlePill) }}
            >
              {label}
            </Button>
          );
        })
      )}
    </Box>
  );

  // The module is already named twice over on a page that has sections: the
  // rail entry beside it is lit, and the section pill (or, on a phone, the
  // dropdown) says which of its pages you are on. A third copy in the corner
  // was just furniture. A module with no sections has neither, and a bar
  // holding nothing but the tenant button reads as a mistake, so that one
  // keeps its name.
  const showTitle = items.length === 0;

  return (
    <Box component="header" sx={{ ...bar, minHeight: compact ? 56 : 68, px: compact ? 1.25 : 2 }}>
      {showTitle && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          {Icon && (
            <Box sx={{ ...tile, color: accent, backgroundColor: `${accent}14` }}>
              <Icon fontSize="small" />
            </Box>
          )}
          <Box
            component="span"
            sx={{
              fontSize: 17,
              fontWeight: 700,
              color: ink.strong,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </Box>
        </Box>
      )}

      {sections}

      {/* Holds the right-hand slot against the edge however few sections there are. */}
      <Box sx={{ flex: 1, minWidth: 0 }} />

      {end}

      {items.length > 0 && (
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                minWidth: 220,
                borderRadius: 3,
                border: `1px solid ${surface.divider}`,
                boxShadow: '0 18px 40px -24px rgba(88,28,135,0.5)'
              }
            },
            list: { 'aria-label': `${title} sections` }
          }}
        >
          {items.map(({ label, route, icon: ItemIcon }) => {
            const active = isSectionActive(route, currentRoute);
            return (
              <MenuItem
                key={route}
                component={Link}
                to={route}
                selected={active}
                aria-current={active ? 'page' : undefined}
                onClick={close}
                sx={{
                  mx: 0.5,
                  borderRadius: 2,
                  minHeight: TOUCH_TARGET,
                  color: active ? accent : ink.body,
                  '&.Mui-selected': { backgroundColor: `${accent}14`, color: accent },
                  '&.Mui-selected:hover': { backgroundColor: `${accent}20` },
                  '&:hover': { backgroundColor: surface.sunken }
                }}
              >
                {ItemIcon && (
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                    <ItemIcon fontSize="small" />
                  </ListItemIcon>
                )}
                <ListItemText slotProps={{ primary: { sx: { fontWeight: active ? 700 : 500 } } }}>{label}</ListItemText>
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </Box>
  );
}

/**
 * Frosted, like the navigation rail beside it, so the two read as one piece of
 * chrome with the page washing through both.
 */
const bar = {
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 1,
  ...chrome,
  borderBottom: `1px solid ${surface.divider}`
} as const;

const tile = {
  width: 34,
  height: 34,
  borderRadius: 2.5,
  display: 'grid',
  placeItems: 'center'
} as const;

const sectionRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minWidth: 0,
  overflowX: 'auto',
  // The row scrolls when a module has more sections than fit; a scrollbar
  // across the chrome would read as a seam.
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' }
} as const;

const compactNav = { minWidth: 0, display: 'flex' } as const;

const pillBase = {
  flexShrink: 0,
  minWidth: 0,
  height: 36,
  px: 1.75,
  borderRadius: 999,
  textTransform: 'none',
  fontSize: 14.5,
  whiteSpace: 'nowrap',
  transition: 'background-color .2s ease, color .2s ease',
  '& .MuiButton-startIcon svg': { fontSize: 19 },
  '& .MuiButton-startIcon, & .MuiButton-endIcon': { flexShrink: 0 }
} as const;

const idlePill = {
  fontWeight: 500,
  color: ink.body,
  '&:hover': { backgroundColor: surface.sunken, color: ink.strong }
} as const;

/** The section being shown, and the compact dropdown that stands in for it. */
const activePill = (accent: string) =>
  ({
    fontWeight: 700,
    color: accent,
    backgroundColor: `${accent}14`,
    boxShadow: `inset 0 0 0 1px ${accent}29`,
    '&:hover': { backgroundColor: `${accent}20` }
  }) as const;

export default SectionBar;
