import { ConfigProvider } from '../config/ConfigProvider';
import { Route, Routes } from 'react-router';
import AppRoutes from '../routes';
import { APP_BASE } from '../appBase';

/**
 * admin-front as shell-front renders it: the module this app exposes over
 * module federation.
 *
 * The shell owns the router, the page chrome and the session gate. The prefix
 * is matched here, not left to the shell: this app's own routes are relative,
 * so without `${APP_BASE}/*` above them they would be matched against the whole
 * address and nothing would render. Standalone `App.tsx` mounts them exactly
 * the same way.
 */
export default function RemoteApp() {
  return (
    <ConfigProvider>
      <Routes>
        <Route path={`${APP_BASE}/*`} element={<AppRoutes />} />
      </Routes>
    </ConfigProvider>
  );
}
