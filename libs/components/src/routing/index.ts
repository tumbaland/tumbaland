/**
 * What survives of the shell/child bridge.
 *
 * The rest — `EmbeddedRouter`, `useShellBridge`, the postMessage contract and
 * the URL helpers that built an iframe `src` — existed only because each module
 * ran in its own cross-origin document. Modules are module-federation remotes
 * now, rendered in the shell's own React tree by `shell-front/src/remotes.ts`,
 * so there is no frame to sync a location into and no second window to ask.
 *
 * `toOrigin` stays because it is a plain URL helper with callers of its own.
 */
export { toOrigin } from './embedContext';
