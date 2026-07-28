export { EmbeddedRouter } from './EmbeddedRouter';
export type { EmbeddedRouterProps } from './EmbeddedRouter';

export { useShellBridge } from './useShellBridge';
export type { ShellBridgeOptions } from './useShellBridge';

export {
  EMBED_FLAG,
  EMBED_PATH,
  buildEmbeddedUrl,
  extractChildPath,
  joinShellPath,
  normalizeEmbedPath,
  readEmbedContext,
  safeUrl,
  toOrigin
} from './embedContext';
export type { EmbedContext } from './embedContext';

export {
  APP_SOURCE,
  SHELL_SOURCE,
  isAppLocationMessage,
  isNavigateTopMessage,
  isShellNavigateMessage
} from './messages';
export type { AppLocationMessage, NavigateTopMessage, ShellNavigateMessage } from './messages';
