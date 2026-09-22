import { ReactNode } from 'react';
import { Link } from 'react-router';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { SectionBar, TOUCH_TARGET, ink, wordmark } from '@tumbaland/frontend-core';
import { APPS, CHAT_APP, isRouteActive, type AppConfigItem } from '../config/apps';

interface ModuleHeaderProps {
  /** The module that owns the address, or undefined on one of the shell's own pages. */
  app: AppConfigItem | undefined;
  currentRoute: string;
  mobile: boolean;
  /** Pinned to the right of the bar: the tenant selector. */
  end?: ReactNode;
  /** Unread messages, shown on the Chat button. */
  unreadChat?: number;
  /**
   * Given on a desktop, where Chat opens as a side panel: the button then
   * toggles it instead of leaving the page.
   */
  onToggleChat?: () => void;
  chatOpen?: boolean;
}

/** The shell's own Home entry, which has no remote and so never comes back from `getAppByRoute`. */
const HOME = APPS.find((app) => app.route === '/');

const ChatIcon = CHAT_APP.icon;

const iconButton = { width: TOUCH_TARGET, height: TOUCH_TARGET, color: ink.body } as const;

/**
 * The bar above whichever module is loaded: its sections, and the tenant the
 * whole session is reading.
 *
 * This is only the shell's binding to the shared `SectionBar`. A module run on
 * its own draws the same bar from its own section list, so the header does not
 * change shape depending on which way the app was opened.
 *
 * On a wider screen Chat is reached from here: outside it, the bar carries a
 * Chat button with the unread count. A phone has Chat in the middle of the tab
 * bar instead. Inside a thread the bar is the only chrome left on a phone, so
 * it carries the way out: back to the list, and Home.
 */
export function ModuleHeader({
  app,
  currentRoute,
  mobile,
  end,
  unreadChat = 0,
  onToggleChat,
  chatOpen = false
}: ModuleHeaderProps) {
  const onHome = currentRoute === '/';
  const inChat = isRouteActive(CHAT_APP.route, currentRoute);
  const inThread = inChat && currentRoute.replace(/\/+$/, '') !== CHAT_APP.route;
  const current = app ?? (onHome ? HOME : undefined);

  const chatLead = inThread ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, ml: -0.75 }}>
      <IconButton component={Link} to={CHAT_APP.route} aria-label="Back to conversations" sx={iconButton}>
        <ArrowBackIcon />
      </IconButton>
      <Box component="span" sx={{ fontSize: 17, fontWeight: 700, color: ink.strong }}>
        {CHAT_APP.name}
      </Box>
    </Box>
  ) : undefined;

  const homeLead = onHome ? (
    <Box component="span" sx={{ ...wordmark, fontSize: mobile ? 22 : 26, pb: 0, lineHeight: 1 }}>
      Tumbaland
    </Box>
  ) : undefined;

  const chatLabel = unreadChat > 0 ? `Chat, ${unreadChat} unread` : 'Chat';
  const chatBadge = (
    <Badge badgeContent={unreadChat} color="error" max={99} invisible={unreadChat === 0}>
      <ChatIcon />
    </Badge>
  );
  const chatButton = onToggleChat ? (
    <IconButton
      onClick={onToggleChat}
      aria-label={chatLabel}
      aria-pressed={chatOpen}
      sx={{ ...iconButton, color: CHAT_APP.color, bgcolor: chatOpen ? `${CHAT_APP.color}1f` : undefined }}
    >
      {chatBadge}
    </IconButton>
  ) : (
    <IconButton component={Link} to={CHAT_APP.route} aria-label={chatLabel} sx={{ ...iconButton, color: CHAT_APP.color }}>
      {chatBadge}
    </IconButton>
  );

  const homeButton = (
    <IconButton component={Link} to="/" aria-label="Home" sx={iconButton}>
      <HomeOutlinedIcon />
    </IconButton>
  );

  return (
    <SectionBar
      title={current?.name ?? 'Tumbaland'}
      icon={current?.icon}
      accent={current?.color}
      items={current?.menu}
      currentRoute={currentRoute}
      compact={mobile}
      // In chat the tenant selector is dropped: conversations come from every
      // group the person is in, not from the tenant being viewed, and a phone
      // needs the width for the way back out.
      end={
        inChat ? (
          homeButton
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: mobile ? 0.5 : 1, minWidth: 0 }}>
            {/* A phone has Chat in the middle of the tab bar instead. */}
            {!mobile && chatButton}
            {end}
          </Box>
        )
      }
      // Home has no sections, so the bar would otherwise say "Home" directly
      // above a greeting that already says where you are, next to a rail entry
      // already lit. The wordmark is the one thing that belongs in that corner
      // and is not a repeat of something else on the screen.
      lead={chatLead ?? homeLead}
    />
  );
}

export default ModuleHeader;
