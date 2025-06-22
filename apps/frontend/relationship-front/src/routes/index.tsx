import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Activities from '../pages/Activities';
import PhotoAlbum from '../pages/PhotoAlbum';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/activities" element={<Activities />} />
      <Route path="/photos" element={<PhotoAlbum />} />
    </Routes>
  );
};

export default AppRoutes;
