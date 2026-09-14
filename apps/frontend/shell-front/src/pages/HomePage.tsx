import { useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router';
import BgImageBox from '../components/BgImageBox';
import { GreetingHeader } from '../components/home/GreetingHeader';
import { QuickActions } from '../components/home/QuickActions';
import { ContinueCard } from '../components/home/ContinueCard';
import { ModuleList } from '../components/home/ModuleList';
import { DailyTodo } from '../components/home/DailyTodo';
import { PlanUsageCard } from '../components/home/PlanUsageCard';
import { moduleForRoute } from '../components/home/modules';
import { getLastVisited } from '../services/lastVisited';
import { User } from '../types';

interface HomePageProps {
  user: User | null;
}

/**
 * The signed-in home: where the app opens, with the tab bar under it for
 * everything else.
 *
 * Built like the first screen of a phone app rather than a web page: a title,
 * a row of one-tap actions, a way back to where you were, the modules as a
 * list, then the daily idea and your plan. On a wider screen the same parts sit
 * in two columns.
 */
export function HomePage({ user }: HomePageProps) {
  const navigate = useNavigate();

  const handleOpen = useCallback((route: string) => navigate(route), [navigate]);

  // Read once per mount: this is a "where was I" shortcut, not live state.
  const resume = useMemo(() => {
    const route = getLastVisited();
    const module = moduleForRoute(route);
    return route && module ? { route, module } : null;
  }, []);

  const column = { display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 }, minWidth: 0 } as const;

  return (
    <Box sx={{ position: 'relative', width: '100%', alignSelf: 'flex-start', minHeight: '100%' }}>
      <BgImageBox />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 960,
          mx: 'auto',
          px: { xs: 2, md: 4 },
          pt: { xs: 2.5, md: 6 },
          pb: { xs: 3, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2.5, md: 3.5 }
        }}
      >
        <GreetingHeader name={user?.name} />

        <QuickActions onOpen={handleOpen} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.35fr) minmax(0, 1fr)' },
            gap: { xs: 2.5, md: 3 },
            alignItems: 'start'
          }}
        >
          <Box sx={column}>
            {resume && <ContinueCard module={resume.module} route={resume.route} onOpen={handleOpen} />}
            <ModuleList onOpen={handleOpen} />
          </Box>

          <Box sx={column}>
            <DailyTodo />
            <PlanUsageCard />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;
