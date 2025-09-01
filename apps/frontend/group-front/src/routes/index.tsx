import { Routes, Route } from 'react-router-dom';
import MyGroupsPage from '../pages/MyGroupsPage';
import GroupDetailsPage from '../pages/GroupDetailsPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<MyGroupsPage />} />
    <Route path="/groups/:id" element={<GroupDetailsPage />} />
  </Routes>
);

export default AppRoutes;
