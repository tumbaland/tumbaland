import { useCallback, useState } from 'react';
import { chatDockAvailable } from '../services/chatDock';

/** Whether chat was left open beside the collage, on this device. */
const CHAT_OPEN_KEY = 'tumbaland.collage.chatOpen';

const readChatOpen = (): boolean => {
  try {
    return window.localStorage.getItem(CHAT_OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Chat beside the canvas, drawn by the shell. Not offered where there is no
 * shell. Whether it was left open is remembered on this device.
 */
export const useChatDockToggle = () => {
  const [chatAvailable] = useState(chatDockAvailable);
  const [chatOpen, setChatOpen] = useState(readChatOpen);
  const toggleChat = useCallback(() => {
    setChatOpen((open) => {
      try {
        window.localStorage.setItem(CHAT_OPEN_KEY, open ? '0' : '1');
      } catch {
        // Private mode: it just starts closed next time.
      }
      return !open;
    });
  }, []);
  return { chatAvailable, chatOpen, toggleChat };
};
