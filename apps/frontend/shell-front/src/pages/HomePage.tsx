import { useCallback } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router';
import BgImageBox from '../components/BgImageBox';
import { GreetingHeader } from '../components/home/GreetingHeader';
import { QuickActions } from '../components/home/QuickActions';
import { DailyTodo } from '../components/home/DailyTodo';
import { MemoryCard } from '../components/home/MemoryCard';
import { RecentPhotos } from '../components/home/RecentPhotos';
import { RecentActivity } from '../components/home/RecentActivity';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { User } from '../types';

interface HomePageProps {
  user: User | null;
}

/**
 * The signed-in home.
 *
 * It used to be navigation and nothing else: a greeting, four shortcuts, and
 * two lists of places to go. Every module it linked to was already one tap
 * away in the rail beside it, so the page said the same thing every day and
 * gave nobody a reason to open it twice.
 *
 * It leads with the data now. The photo from this date in an earlier year is
 * different every morning and is the whole argument for coming back; under it
 * are the last few journal entries and the newest photos, so the page shows
 * that the thing is being kept rather than listing the rooms it is kept in.
 *
 * No launcher: the module list and "continue where you left off" repeated the
 * navigation and the quick actions, so they were taken out.
 */
export function HomePage({ user }: HomePageProps) {
  const navigate = useNavigate();
  const { memories, photos, activities } = useHomeFeed();

  const handleOpen = useCallback((route: string) => navigate(route), [navigate]);

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
          pt: { xs: 2.5, md: 5 },
          pb: { xs: 3, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2.5, md: 3 }
        }}
      >
        <GreetingHeader name={user?.name} />

        {/* Renders nothing on a date with no history, which is most of the
            first year. The page reads fine without it. */}
        {memories && <MemoryCard memories={memories} onOpen={handleOpen} />}

        <QuickActions onOpen={handleOpen} />

        <RecentPhotos photos={photos} onOpen={handleOpen} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.35fr) minmax(0, 1fr)' },
            gap: { xs: 2.5, md: 3 },
            alignItems: 'start'
          }}
        >
          <Box sx={column}>
            <RecentActivity activities={activities} onOpen={handleOpen} />
          </Box>

          <Box sx={column}>
            <DailyTodo />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;
