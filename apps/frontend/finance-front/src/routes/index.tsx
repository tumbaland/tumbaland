import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import FinancialRecords from '../pages/FinancialRecords';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/records" element={
        <ProtectedRoute>
          <FinancialRecords />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;
