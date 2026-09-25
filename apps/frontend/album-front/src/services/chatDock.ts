/**
 * Chat drawn inside a page of this app, by the shell.
 *
 * The collage editor covers the whole screen, the shell's chat panel with it,
 * and album-front cannot load chat itself: it does not know where chat lives,
 * and on its own origin there is no chat at all. So it hands the shell an
 * element, and the shell draws chat's panel into it. A window event rather
 * than shared code, so neither side needs a new @tumbaland/frontend-core.
 *
 * shell-front's ChatDockHost is the other half, and carries the same names.
 */

export const CHAT_DOCK_EVENT = 'tumbaland:chat-dock';

/** Set on window by the shell while it is listening. */
const HOST_FLAG = '__tumbalandChatDock';

export interface ChatDockRequest {
  /** Where to draw chat, or null to take it away. */
  container: HTMLElement | null;
  /** The panel's own close button was pressed. */
  onClose?: () => void;
}

/** Whether a shell is here to draw chat. False when album-front runs on its own. */
export const chatDockAvailable = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>)[HOST_FLAG]);

export const requestChatDock = (request: ChatDockRequest): void => {
  window.dispatchEvent(new CustomEvent<ChatDockRequest>(CHAT_DOCK_EVENT, { detail: request }));
};

/** What a chat photo carries when dragged, naming the file it is. */
export const CHAT_FILE_DRAG_TYPE = 'application/x-tumbaland-file';
