import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { requestChatDock } from '../../services/chatDock';

interface CollageChatDockProps {
  /** Beside the canvas on a wide screen, under it on a phone. */
  layout: 'side' | 'bottom';
  onClose: () => void;
}

/**
 * The space chat takes beside the collage. The shell draws chat's panel into
 * it (see services/chatDock), so talking and arranging happen side by side,
 * and a photo in the chat can be dragged straight onto the canvas.
 */
const CollageChatDock: React.FC<CollageChatDockProps> = ({ layout, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    requestChatDock({ container: ref.current, onClose: () => closeRef.current() });
    return () => requestChatDock({ container: null });
  }, []);

  return (
    <Box
      ref={ref}
      aria-label="Chat"
      sx={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: 'background.default',
        ...(layout === 'side'
          ? { width: 'clamp(300px, 28vw, 380px)', borderLeft: '1px solid', borderColor: 'divider' }
          : { height: '42%', borderTop: '1px solid', borderColor: 'divider' })
      }}
    />
  );
};

export default CollageChatDock;
