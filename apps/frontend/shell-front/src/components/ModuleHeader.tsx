import { ReactNode } from 'react';
import { SectionBar } from '@tumbaland/frontend-core';
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
 * The bar above whichever module is loaded: its name, its sections, and the
 * tenant the whole session is reading.
 *
 * This is only the shell's binding to the shared `SectionBar`. A module run on
 * its own draws the same bar from its own section list, so the header does not
 * change shape depending on which way the app was opened.
 */
export function ModuleHeader({ app, currentRoute, mobile, end }: ModuleHeaderProps) {
  const current = app ?? (currentRoute === '/' ? HOME : undefined);

  return (
    <SectionBar
      title={current?.name ?? 'Tumbaland'}
      icon={current?.icon}
      accent={current?.color}
      items={current?.menu}
      currentRoute={currentRoute}
      compact={mobile}
      end={end}
    />
  );
}

export default ModuleHeader;
