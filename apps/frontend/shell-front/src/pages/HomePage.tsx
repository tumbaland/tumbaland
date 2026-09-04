import { useCallback, useMemo } from 'react';
import { Box, Button } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router';
import BgImageBox from '../components/BgImageBox';
import { GreetingHeader } from '../components/home/GreetingHeader';
import { ModuleCard } from '../components/home/ModuleCard';
import { DailyTodo } from '../components/home/DailyTodo';
import { PlanUsageCard } from '../components/home/PlanUsageCard';
import { HOME_MODULES, moduleForRoute } from '../components/home/modules';
import { getLastVisited } from '../services/lastVisited';
import { User } from '../types';

interface HomePageProps {
  user: User | null;
}

/**
 * The signed-in home. Replaces the random-todo card, which showed nothing the
 * user owned and offered no route into any of the four modules — all the
 * navigation work was falling to the side menu.
 */
export function HomePage({ user }: HomePageProps) {
  const navigate = useNavigate();

  const handleOpen = useCallback((route: string) => navigate(route), [navigate]);

  // Read once per mount: this is a "where was I" shortcut, not live state.
  const resumeModule = useMemo(() => moduleForRoute(getLastVisited()), []);

  return (
    <Box sx={{ position: 'relative', width: '100%', alignSelf: 'flex-start', minHeight: '100%' }}>
      <BgImageBox />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 900,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          pt: { xs: 5, md: 7 },
          pb: { xs: 5, md: 7 }
        }}
      >
        <GreetingHeader name={user?.name} />

        {/* Directly under the greeting rather than at the foot of the page: it
            is the one thing here with any personality, and nothing below it is
            worse for being read second. */}
        <DailyTodo />

        {resumeModule && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Button
              startIcon={<HistoryIcon />}
              onClick={() => handleOpen(resumeModule.route)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 999,
                px: 2.25,
                py: 0.75,
                color: resumeModule.color,
                backgroundColor: `${resumeModule.color}14`,
                '&:hover': { backgroundColor: `${resumeModule.color}26` }
              }}
            >
              Back to {resumeModule.name}
            </Button>
          </Box>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: { xs: 1.75, md: 2.25 }
          }}
        >
          {HOME_MODULES.map((module) => (
            <ModuleCard key={module.key} module={module} onOpen={handleOpen} />
          ))}
        </Box>

        <PlanUsageCard />
      </Box>
    </Box>
  );
}

export default HomePage;
