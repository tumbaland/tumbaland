import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Loader, lazyPage } from '@tumbaland/frontend-core';

// The dashboard carries the map; the journal does not need it.
const Dashboard = lazyPage(() => import('../pages/Dashboard'));
const JournalPage = lazyPage(() => import('../pages/JournalPage'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<Loader fullHeight={false} />}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="journal" element={<JournalPage />} />
        {/* The map is a card on the dashboard now; old links and bookmarks land there. */}
        <Route path="map" element={<Navigate to="../dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
