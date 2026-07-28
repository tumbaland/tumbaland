import { Routes, Route, Navigate } from 'react-router';
import AlbumsPage from '../pages/AlbumsPage';
import AlbumDetailPage from '../pages/AlbumDetailPage';
import PhotoDetailPage from '../pages/PhotoDetailPage';
import CollageListPage from '../pages/CollageListPage';
import CollageDetailsPage from '../pages/CollageDetailsPage';
import DashboardPage from '../pages/DashboardPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="albums" element={<AlbumsPage />} />
      <Route path="albums/:albumId" element={<AlbumDetailPage />} />
      <Route path="albums/:albumId/photos/:photoId" element={<PhotoDetailPage />} />
      <Route path="collages" element={<CollageListPage />} />
      <Route path="collages/:id" element={<CollageDetailsPage />} />
    </Routes>
  );
};

export default AppRoutes;
