import { Routes, Route } from 'react-router-dom';
import MyGroupsPage from '../pages/MyGroupsPage';
import AcceptInvitePage from '../pages/AcceptInvitePage';
import GroupDetailsPage from '../pages/GroupDetailsPage';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<MyGroupsPage />} />
    <Route path="/groups/:id" element={<GroupDetailsPage />} />
    <Route path="/accept" element={<AcceptInvitePage />} />
  </Routes>
);

export default AppRoutes;
