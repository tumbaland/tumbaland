import { Routes, Route, Navigate } from 'react-router-dom';
import AlbumsPage from '../pages/AlbumsPage';
import AlbumDetailPage from '../pages/AlbumDetailPage';
import PhotoCollage from '../pages/PhotoCollage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/albums" replace />} />
      <Route path="/albums" element={<AlbumsPage />} />
      <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
      <Route path="/collage" element={<PhotoCollage />} />
    </Routes>
  );
};

export default AppRoutes;
