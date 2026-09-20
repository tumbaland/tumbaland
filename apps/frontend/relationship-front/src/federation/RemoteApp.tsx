import { ConfigProvider } from '../config/ConfigProvider';
import { Route, Routes } from 'react-router';
import AppRoutes from '../routes';
import { APP_BASE } from '../appBase';

/**
 * relationship-front as shell-front renders it: the module this app exposes over
 * module federation.
 *
 * The shell owns the router, the page chrome and the session gate, and keeps
 * its navigation mounted while this is swapped in underneath — which is the
 * point of the move away from an iframe per module. What stays here is only
 * what this app's own pages need.
 *
 * The prefix is matched here, not left to the shell: this app's own routes are
 * relative, so without `${APP_BASE}/*` above them they would be matched against
 * the whole address and nothing would render — a blank page, not an error.
 * Standalone `App.tsx` mounts them exactly the same way.
 *
 * `ConfigProvider` reads this app's own config.json from this app's origin,
 * not the shell's page — see the `configUrl` it passes.
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
