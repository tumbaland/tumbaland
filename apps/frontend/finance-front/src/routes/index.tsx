import { Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import FinancialRecords from '../pages/FinancialRecords';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/records" element={<FinancialRecords />} />
    </Routes>
  );
};

export default AppRoutes;
