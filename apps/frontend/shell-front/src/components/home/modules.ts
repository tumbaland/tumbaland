import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';

type IconComponent = React.ComponentType<{ sx?: object }>;

/**
 * Today as the journal keys a day: the UTC date, the same way JournalPage's own
 * `todayKey` does, so "Log today" opens the day the journal itself calls today.
 */
export const journalTodayKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export interface QuickAction {
  key: string;
  label: string;
  color: string;
  icon: IconComponent;
  /** Resolved when pressed, so "today" is the day it is tapped, not the day the page loaded. */
  route: () => string;
}

/** One tap each, for the things people open the app to do. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'log-today',
    label: 'Log today',
    color: '#ef4444',
    icon: EditCalendarIcon,
    // The journal opens its day editor for a `?date=` link.
    route: () => `/relationship/journal?date=${journalTodayKey()}`
  },
  { key: 'albums', label: 'Albums', color: '#3b82f6', icon: PhotoLibraryIcon, route: () => '/album/albums' },
  { key: 'chat', label: 'Chat', color: '#0f766e', icon: ChatBubbleIcon, route: () => '/chat' }
];
