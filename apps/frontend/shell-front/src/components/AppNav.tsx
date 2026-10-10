import { MouseEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { CHAT_APP, USER_APPS, getMainApps, isRouteActive } from '../config/apps';
import { accentOnDark, brand, chrome, DARK, ink, surface } from '@tumbaland/frontend-core';
import { User } from '../types';
import { useWhatsNew } from '../hooks/useWhatsNew';
import { AccountMenu } from './AccountMenu';
import { WhatsNewDialog } from './WhatsNewDialog';

interface AppNavProps {
  currentRoute: string;
  user: User | null;
  /** Phones get a tab bar under the content; anything wider gets a rail beside it. */
  mobile: boolean;
  /** Unread messages, shown on the tab bar's Chat entry. */
  unreadChat?: number;
  /** Whether Money is in the menu: off unless turned on under Profile > Features. */
  showMoney?: boolean;
}

/**
 * The one navigation for a signed-in session, drawn around every module.
 *
 * Every entry carries a visible label. The icon-only rail it replaces leaned on
 * tooltips, which a touch screen never shows, and its burger button sat on top
 * of each module's own header. Profile, Groups and Billing live behind the
 * Account entry at the end, which is the only account menu there is: the framed
 * apps hide their own while embedded.
 */
export function AppNav({ currentRoute, user, mobile, unreadChat = 0, showMoney = false }: AppNavProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const { unseen, markSeen } = useWhatsNew();
  const onAccountPage = USER_APPS.some((app) => isRouteActive(app.route, currentRoute));

  // On a phone Chat sits in the middle of the tab bar, under the thumb, rather
  // than in the header at the top of the screen. Wider screens keep it in the
  // header bar.
  const apps = getMainApps({ showMoney });
  const entries = mobile ? [...apps.slice(0, 2), CHAT_APP, ...apps.slice(2)] : apps;

  return (
    <Box component="nav" aria-label="Main" sx={mobile ? bottomBar : rail}>
      {entries.map((app) => {
        const Icon = app.icon;
        const isChat = app === CHAT_APP;

        return (
          <NavItem
            key={app.route}
            to={app.route}
            label={app.name}
            ariaLabel={isChat && unreadChat > 0 ? `Chat, ${unreadChat} unread` : undefined}
            color={app.color}
            icon={
              isChat ? (
                <Badge badgeContent={unreadChat} color="error" max={99} invisible={unreadChat === 0}>
                  <Icon />
                </Badge>
              ) : (
                <Icon />
              )
            }
            active={isRouteActive(app.route, currentRoute)}
            mobile={mobile}
          />
        );
      })}

      {/* Pins Account to the foot of the rail, away from the modules. */}
      {!mobile && <Box sx={{ flex: 1 }} />}

      <NavItem
        label="Account"
        ariaLabel={unseen ? 'Account, has changes you have not seen' : undefined}
        color={brand.purple}
        icon={
          // A dot, not a count: it says that something changed, which is all
          // it knows. Chat's red number is for messages and stays distinct.
          <Badge variant="dot" color="primary" overlap="circular" invisible={!unseen}>
            {user?.picture ? <Avatar src={user.picture} alt="" sx={{ width: 26, height: 26 }} /> : <AccountCircleIcon />}
          </Badge>
        }
        active={menuOpen || onAccountPage}
        mobile={mobile}
        onClick={(event: MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget)}
        expanded={menuOpen}
      />

      <AccountMenu
        user={user}
        anchorEl={menuAnchor}
        currentRoute={currentRoute}
        mobile={mobile}
        onClose={() => setMenuAnchor(null)}
        onOpenWhatsNew={() => {
          markSeen();
          setWhatsNewOpen(true);
        }}
        whatsNewUnseen={unseen}
      />

      <WhatsNewDialog open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
    </Box>
  );
}

interface NavItemProps {
  label: string;
  /** Read out in place of the label, when the icon carries more (an unread count). */
  ariaLabel?: string;
  icon: ReactNode;
  color: string;
  active: boolean;
  mobile: boolean;
  /** Route to link to. Without one the item is a button that opens a menu. */
  to?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  expanded?: boolean;
}

function NavItem({ label, ariaLabel, icon, color, active, mobile, to, onClick, expanded }: NavItemProps) {
  const sx = {
    flex: mobile ? 1 : 'none',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.5,
    py: 0.5,
    borderRadius: 3,
    color: active ? ink.strong : ink.muted,
    WebkitTapHighlightColor: 'transparent',
    '& .nav-pill': {
      width: 56,
      height: 32,
      borderRadius: 999,
      display: 'grid',
      placeItems: 'center',
      color: active ? color : ink.body,
      backgroundColor: active ? `${color}1f` : 'transparent',
      transition: 'background-color .2s ease, color .2s ease, transform .15s ease',
      [DARK]: active ? { color: accentOnDark(color), backgroundColor: `${color}3d` } : {}
    },
    '&:hover .nav-pill': { backgroundColor: active ? `${color}2e` : surface.hover },
    '&:active .nav-pill': { transform: 'scale(0.94)' },
    '&.Mui-focusVisible .nav-pill': { outline: `2px solid ${brand.violet}`, outlineOffset: 1 }
  } as const;

  const body = (
    <>
      <Box className="nav-pill">{icon}</Box>
      <Box
        component="span"
        sx={{
          maxWidth: '100%',
          fontSize: mobile ? 11 : 11.5,
          fontWeight: active ? 700 : 500,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {label}
      </Box>
    </>
  );

  if (to) {
    return (
      <ButtonBase
        component={Link}
        to={to}
        aria-current={active ? 'page' : undefined}
        aria-label={ariaLabel}
        disableRipple
        sx={sx}
      >
        {body}
      </ButtonBase>
    );
  }

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={expanded}
      disableRipple
      sx={sx}
    >
      {body}
    </ButtonBase>
  );
}

/** The same frosted chrome the header bar is drawn in, so the two meet cleanly. */
const glassBar = {
  ...chrome,
  flexShrink: 0,
  zIndex: 3
} as const;

const rail = {
  ...glassBar,
  width: 88,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  px: 0.5,
  py: 2,
  overflowY: 'auto',
  borderRight: `1px solid ${surface.chromeEdge}`
} as const;

const bottomBar = {
  ...glassBar,
  display: 'flex',
  px: 0.5,
  pt: 0.75,
  pb: 'calc(6px + env(safe-area-inset-bottom))',
  borderTop: `1px solid ${surface.chromeEdge}`
} as const;

export default AppNav;
