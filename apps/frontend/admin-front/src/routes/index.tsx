import { Container } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router';
import { gutter, ProtectedRoute } from '@tumbaland/frontend-core';
import { appPath } from '../appBase';
import AssistantsPage from '../pages/AssistantsPage';
import ClaudePage from '../pages/ClaudePage';
import DeletionsPage from '../pages/DeletionsPage';
import OverviewPage from '../pages/OverviewPage';
import UserDetailPage from '../pages/UserDetailPage';
import UsersPage from '../pages/UsersPage';
import { authService } from '../services/authService';

/**
 * This app's pages, one route each.
 *
 * The width cap and the gutter are here rather than in each page, so every one
 * is the same shape wherever it is shown. Who may see them is the server's to
 * say: every request is refused unless the session is an administrator's, and
 * the shell does not list or frame this app for anyone else.
 */
const AppRoutes = () => (
  <ProtectedRoute authService={authService}>
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: gutter }}>
      <Routes>
        <Route path="" element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="assistants" element={<AssistantsPage />} />
        <Route path="claude" element={<ClaudePage />} />
        <Route path="deletions" element={<DeletionsPage />} />
        {/* Absolute: a relative target in a splat route resolves under the address that did not match. */}
        <Route path="*" element={<Navigate to={appPath('/overview')} replace />} />
      </Routes>
    </Container>
  </ProtectedRoute>
);

export default AppRoutes;
