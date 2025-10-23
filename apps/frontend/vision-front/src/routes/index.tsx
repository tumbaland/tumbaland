import { Routes, Route, Navigate } from 'react-router-dom';
import TrainingsPage from '../pages/TrainingsPage';
import TrainingDetailPage from '../pages/TrainingDetailPage';
import EpochsPage from '../pages/EpochsPage';
import ConfigsPage from '../pages/ConfigsPage';
import AnalysisPage from '../pages/AnalysisPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/trainings" replace />} />
      <Route path="/trainings" element={<TrainingsPage />} />
      <Route path="/trainings/:id" element={<TrainingDetailPage />} />
      <Route path="/epochs" element={<EpochsPage />} />
      <Route path="/configs" element={<ConfigsPage />} />
      <Route path="/analysis" element={<AnalysisPage />} />
    </Routes>
  );
}

export default AppRoutes;
