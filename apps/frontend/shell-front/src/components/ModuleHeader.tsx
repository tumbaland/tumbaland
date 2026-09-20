import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { SectionBar, wordmark } from '@tumbaland/frontend-core';
import { APPS, type AppConfigItem } from '../config/apps';

interface ModuleHeaderProps {
  /** The module that owns the address, or undefined on one of the shell's own pages. */
  app: AppConfigItem | undefined;
  currentRoute: string;
  mobile: boolean;
  /** Pinned to the right of the bar: the tenant selector. */
  end?: ReactNode;
}

/** The shell's own Home entry, which has no remote and so never comes back from `getAppByRoute`. */
const HOME = APPS.find((app) => app.route === '/');

/**
 * The bar above whichever module is loaded: its sections, and the tenant the
 * whole session is reading.
 *
 * This is only the shell's binding to the shared `SectionBar`. A module run on
 * its own draws the same bar from its own section list, so the header does not
 * change shape depending on which way the app was opened.
 */
export function ModuleHeader({ app, currentRoute, mobile, end }: ModuleHeaderProps) {
  const onHome = currentRoute === '/';
  const current = app ?? (onHome ? HOME : undefined);

  return (
    <SectionBar
      title={current?.name ?? 'Tumbaland'}
      icon={current?.icon}
      accent={current?.color}
      items={current?.menu}
      currentRoute={currentRoute}
      compact={mobile}
      end={end}
      // Home has no sections, so the bar would otherwise say "Home" directly
      // above a greeting that already says where you are, next to a rail entry
      // already lit. The wordmark is the one thing that belongs in that corner
      // and is not a repeat of something else on the screen.
      lead={
        onHome ? (
          <Box component="span" sx={{ ...wordmark, fontSize: mobile ? 22 : 26, pb: 0, lineHeight: 1 }}>
            Tumbaland
          </Box>
        ) : undefined
      }
    />
  );
}

export default ModuleHeader;
