import { Routes, Route, Navigate } from 'react-router-dom';
import TrainingsPage from '../pages/TrainingsPage';
import TrainingDetailPage from '../pages/TrainingDetailPage';
import TrainingComparisonPage from '../pages/TrainingComparisonPage';
import EpochsPage from '../pages/EpochsPage';
import ConfigsPage from '../pages/ConfigsPage';
import AnalysisPage from '../pages/AnalysisPage';
import DatasetComparisonPage from '../pages/DatasetComparisonPage';
import DatasetDetailPage from '../pages/DatasetDetailPage';
import ImageLabelingPage from '../pages/ImageLabelingPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/trainings" replace />} />
      <Route path="/trainings" element={<TrainingsPage />} />
      <Route path="/trainings/:id" element={<TrainingDetailPage />} />
      <Route path="/trainings/compare" element={<TrainingComparisonPage />} />
      <Route path="/epochs" element={<EpochsPage />} />
      <Route path="/configs" element={<ConfigsPage />} />
      <Route path="/analysis" element={<AnalysisPage />} />
      <Route path="/analysis/:id" element={<DatasetDetailPage />} />
      <Route path="/analysis/compare" element={<DatasetComparisonPage />} />
      <Route path="/image-labeling" element={<ImageLabelingPage />} />
    </Routes>
  );
}

export default AppRoutes;
