import { Suspense, useState } from 'react';
import { useLocation } from 'react-router';
import { Loader } from '@tumbaland/components';
import { getAppByRoute } from '../config/apps';
import { forgetRemote, remoteComponent } from '../remotes';
import { RemoteBoundary } from './RemoteBoundary';

/**
 * Renders whichever module owns the current path.
 *
 * The module's own `<Routes>` then match inside it exactly as they do
 * standalone: each app mounts its routes under its own prefix in both modes
 * (see each app's `appBase.ts`), so one address means the same thing wherever
 * it is read.
 */
export function RemoteOutlet() {
  const { pathname } = useLocation();
  const [attempt, setAttempt] = useState(0);
  const app = getAppByRoute(pathname);

  if (!app) return null;

  const Remote = remoteComponent(app);

  return (
    <RemoteBoundary
      key={`${app.remote}:${attempt}`}
      appTitle={app.name}
      onRetry={() => {
        forgetRemote(app);
        setAttempt((n) => n + 1);
      }}
    >
      {/* Only the first visit to a module waits here; its code stays loaded
          afterwards, so coming back renders straight away. */}
      <Suspense fallback={<Loader message={`Loading ${app.name}`} />}>
        {/* Not a component built during render: `remoteComponent` caches one
            lazy component per app and hands back the same reference every
            time, which is what keeps a loaded module mounted rather than
            remounting it. `remotes.test.ts` asserts that identity. */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Remote />
      </Suspense>
    </RemoteBoundary>
  );
}

export default RemoteOutlet;
