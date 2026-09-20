import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from '@tumbaland/frontend-core';
import { authService } from './services/authService';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { APP_BASE } from './appBase';

/**
 * relationship-front run on its own, outside the shell.
 *
 * The routes are mounted at the same prefix the shell mounts them at, so an
 * address like `/relationship/...` means the same thing in both — see `appBase`.
 * Inside the shell this file is not used at all; `federation/RemoteApp` is.
 */
function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute authService={authService}>
      <AppLayout>
        <Routes>
          <Route path={`${APP_BASE}/*`} element={<AppRoutes />} />
          <Route path="*" element={<Navigate to={APP_BASE} replace />} />
        </Routes>
      </AppLayout>
      </ProtectedRoute>
    </BrowserRouter>
  );
}

export default App;
