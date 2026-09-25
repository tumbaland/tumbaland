import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChatPanel } from './ChatPanel';

/**
 * Chat drawn inside a module's page, when the module asks.
 *
 * The collage editor covers the whole screen, the side panel with it, so it
 * hands over an element of its own and chat's panel is drawn into that. The
 * module cannot load chat itself: it does not know where chat lives. A window
 * event, so the contract needs no shared package; album-front's
 * services/chatDock is the other half and carries the same names.
 */
export const CHAT_DOCK_EVENT = 'tumbaland:chat-dock';

/** Set on window while this host is listening, so a module knows to offer chat. */
const HOST_FLAG = '__tumbalandChatDock';

interface ChatDockRequest {
  container: HTMLElement | null;
  onClose?: () => void;
}

interface ChatDockHostProps {
  /** Told whether chat is docked somewhere, so the side panel does not open a second copy. */
  onDockedChange: (docked: boolean) => void;
}

export function ChatDockHost({ onDockedChange }: ChatDockHostProps) {
  const [request, setRequest] = useState<ChatDockRequest | null>(null);

  useEffect(() => {
    const flags = window as unknown as Record<string, unknown>;
    flags[HOST_FLAG] = true;
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<ChatDockRequest>).detail;
      setRequest(detail?.container ? detail : null);
    };
    window.addEventListener(CHAT_DOCK_EVENT, onRequest);
    return () => {
      delete flags[HOST_FLAG];
      window.removeEventListener(CHAT_DOCK_EVENT, onRequest);
    };
  }, []);

  const docked = Boolean(request?.container);
  useEffect(() => onDockedChange(docked), [docked, onDockedChange]);

  if (!request?.container) return null;
  return createPortal(<ChatPanel onClose={() => request.onClose?.()} fill />, request.container);
}
