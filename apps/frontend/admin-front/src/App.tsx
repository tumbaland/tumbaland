import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AppLayout from './components/AppLayout';
import AppRoutes from './routes';
import { APP_BASE } from './appBase';

/**
 * admin-front run on its own, outside the shell.
 *
 * The routes are mounted at the same prefix the shell mounts them at, so an
 * address like `/admin/users` means the same thing in both. Inside the shell
 * this file is not used at all; `federation/RemoteApp` is.
 */
function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path={`${APP_BASE}/*`} element={<AppRoutes />} />
          <Route path="*" element={<Navigate to={APP_BASE} replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
