import { ReactNode } from 'react';
import { useLocation } from 'react-router';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { AppLayout as SharedAppLayout, moduleAccent, SectionBar } from '@tumbaland/frontend-core';
import { ADMIN_SECTIONS } from '../sections';

/**
 * Thin binding to the shared layout.
 *
 * Only this app run on its own comes through here: inside the shell,
 * `federation/RemoteApp` renders the routes and the shell draws the header,
 * so the bar below is never doubled.
 */
const AppLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  return (
    <SharedAppLayout
      header={
        <SectionBar
          title="Admin"
          icon={AdminPanelSettingsIcon}
          accent={moduleAccent.profile}
          items={ADMIN_SECTIONS}
          currentRoute={pathname}
          compact={compact}
        />
      }
    >
      {children}
    </SharedAppLayout>
  );
};

export default AppLayout;
