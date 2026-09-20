import { ReactNode } from 'react';
import { useLocation } from 'react-router';
import PersonIcon from '@mui/icons-material/Person';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { AppLayout as SharedAppLayout, moduleAccent, SectionBar } from '@tumbaland/frontend-core';
import { ACCOUNT_SECTIONS } from '../sections';

/**
 * Thin binding to the shared layout, kept so pages' import paths stay put.
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
          title="Profile"
          icon={PersonIcon}
          accent={moduleAccent.profile}
          items={ACCOUNT_SECTIONS}
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
