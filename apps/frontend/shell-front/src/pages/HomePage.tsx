import { useCallback } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router';
import BgImageBox from '../components/BgImageBox';
import { GreetingHeader } from '../components/home/GreetingHeader';
import { DailyTodo } from '../components/home/DailyTodo';
import { HomeMilestones } from '../components/home/HomeMilestones';
import { HomePlans } from '../components/home/HomePlans';
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
 * No launcher: the module list, "continue where you left off" and the Log,
 * Albums and Chat buttons all repeated the menu beside the page, so they were
 * taken out.
 */
export function HomePage({ user }: HomePageProps) {
  const navigate = useNavigate();
  const { memories, photos, activities, milestones, plans } = useHomeFeed();

  const handleOpen = useCallback((route: string) => navigate(route), [navigate]);

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

        {/* What the two of them have coming: a concert tonight is the most
            useful thing this page can say on the day. Nothing when nothing is planned. */}
        <HomePlans plans={plans} onOpen={handleOpen} />

        {/* Under the memory: the day count changes every morning and the
            rows say what is coming, beside what was written this week. Side by
            side where there is room, stacked on a phone. auto-fit drops an
            empty track, so when one of the two renders nothing (no start date,
            or a quiet journal) the other takes the whole row. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: { xs: 2.5, md: 3 },
            alignItems: 'start'
          }}
        >
          {milestones && <HomeMilestones milestones={milestones} onOpen={handleOpen} />}
          <RecentActivity activities={activities} onOpen={handleOpen} />
        </Box>

        <RecentPhotos photos={photos} onOpen={handleOpen} />

        <DailyTodo />
      </Box>
    </Box>
  );
}

export default HomePage;
