/**
 * Module-federation settings every Tumbaland front has to agree on.
 *
 * shell-front is the host; journal, album, money, account, groups and billing
 * are remotes it loads at runtime from their own origins. This replaces the
 * iframe-per-module shell: an iframe meant each module switch threw away a
 * whole JS context and booted a new one, which is why opening a module
 * re-checked the session, re-fetched its data and lost whatever the previous
 * one had on screen.
 *
 * The shared singletons are the libraries that hold React context or global
 * state. A remote running its own copy of React breaks hooks outright, and its
 * own copy of the router, Emotion or React Query reads an empty context instead
 * of the one the host's providers filled — so every app must take the single
 * copy the host loaded. The list lives here rather than in seven vite configs
 * because drift between those copies is precisely that failure.
 *
 * Plain data with no React imports: each `vite.config.mts` loads it in Node.
 */
export const TUMBALAND_FEDERATION_SHARED = {
  react: { singleton: true },
  'react-dom': { singleton: true },
  // Tumbaland is on `react-router` v8, which is the package that holds the
  // router context — there is no `react-router-dom` to share.
  'react-router': { singleton: true },
  '@emotion/react': { singleton: true },
  '@emotion/styled': { singleton: true },
  '@mui/material': { singleton: true },
  // Only album and money use it today. Shared anyway: a second copy in one of
  // them would read an empty cache rather than fail loudly, which is the
  // harder bug to find.
  '@tanstack/react-query': { singleton: true }
};

/** File each remote serves its federation entry as, at the root of its origin. */
export const TUMBALAND_REMOTE_ENTRY = 'remoteEntry.js';

/** The module every remote exposes: its routes wrapped in its own providers. */
export const TUMBALAND_REMOTE_MODULE = './App';
