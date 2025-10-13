import { Routes, Route, Navigate } from 'react-router-dom';
import DatasetsPage from '../pages/DatasetsPage';
import TrainingsPage from '../pages/TrainingsPage';
import TrainingDetailPage from '../pages/TrainingDetailPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/datasets" replace />} />
      <Route path="/datasets" element={<DatasetsPage />} />
      <Route path="/trainings" element={<TrainingsPage />} />
      <Route path="/trainings/:id" element={<TrainingDetailPage />} />
    </Routes>
  );
}

export default AppRoutes;
