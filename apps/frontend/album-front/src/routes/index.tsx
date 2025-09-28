import { Routes, Route, Navigate } from 'react-router-dom';
import AlbumsPage from '../pages/AlbumsPage';
import AlbumDetailPage from '../pages/AlbumDetailPage';
import PhotoDetailPage from '../pages/PhotoDetailPage';
import CollageListPage from '../pages/CollageListPage';
import CollageDetailsPage from '../pages/CollageDetailsPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="" element={<Navigate to="albums" replace />} />
      <Route path="albums" element={<AlbumsPage />} />
      <Route path="albums/:albumId" element={<AlbumDetailPage />} />
      <Route path="albums/:albumId/photos/:photoId" element={<PhotoDetailPage />} />
      <Route path="collage" element={<CollageListPage />} />
      <Route path="collage/:id" element={<CollageDetailsPage />} />
    </Routes>
  );
};

export default AppRoutes;
