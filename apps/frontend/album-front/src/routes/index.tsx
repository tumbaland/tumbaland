import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Loader, lazyPage } from '@tumbaland/frontend-core';

// One chunk per page, so the collage editor is only fetched by someone who opens a collage.
const AlbumsPage = lazyPage(() => import('../pages/AlbumsPage'));
const AlbumDetailPage = lazyPage(() => import('../pages/AlbumDetailPage'));
const PhotoDetailPage = lazyPage(() => import('../pages/PhotoDetailPage'));
const CollageListPage = lazyPage(() => import('../pages/CollageListPage'));
const CollageDetailsPage = lazyPage(() => import('../pages/CollageDetailsPage'));
const DashboardPage = lazyPage(() => import('../pages/DashboardPage'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<Loader fullHeight={false} />}>
      <Routes>
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="albums" element={<AlbumsPage />} />
        <Route path="albums/:albumId" element={<AlbumDetailPage />} />
        <Route path="albums/:albumId/photos/:photoId" element={<PhotoDetailPage />} />
        <Route path="collages" element={<CollageListPage />} />
        <Route path="collages/:id" element={<CollageDetailsPage />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
