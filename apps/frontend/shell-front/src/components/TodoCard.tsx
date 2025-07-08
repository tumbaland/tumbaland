import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useConfig } from '../hooks/useConfig';

export default function TodoCard() {
  const config = useConfig();
  const API_URL = config.PUBLIC_API_URL;
  const [todo, setTodo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/todo/random`)
      .then(res => res.json())
      .then((data: { todo: string }) => {
        if (data && data.todo) {
          setTodo(data.todo);
        }
      });
  }, [API_URL]);

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <Box
        sx={{
          mb: 2,
          textAlign: 'center',
          fontFamily: '"Pacifico", cursive, Inter, sans-serif',
          fontWeight: 800,
          fontSize: 52,
          color: '#ff1fae',
          letterSpacing: 2,
        }}
      >
        Welcome to Tumbaland
      </Box>
      <Box
        component="img"
        src="/b2.jpg"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 0,
          opacity: 0.55,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      <Box sx={{
        position: 'relative',
        zIndex: 1,
        bgcolor: 'rgba(255,255,255,0.18)',
        p: 4,
        borderRadius: 4,
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
        minWidth: 340,
        maxWidth: 400,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1.5px solid rgba(255,255,255,0.32)',
      }}>
        <p style={{
          fontSize: 22,
          fontWeight: 500,
          color: '#ff1fae',
          margin: '24px 0 16px 0',
          minHeight: 48
        }}>
          {todo || 'Loading...'}
        </p>
        <button
          aria-label="Roll for new todo"
          onClick={() => {
            fetch(`${API_URL}/api/todo/random`)
              .then(res => res.json())
              .then((data: { todo: string }) => {
                if (data && data.todo) {
                  setTodo(data.todo);
                }
              });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            outline: 'none',
            padding: 0,
            width: 44,
            height: 44,
            borderRadius: '50%',
            transition: 'background 0.18s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,31,174,0.12)')}
          onMouseOut={e => (e.currentTarget.style.background = 'none')}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <AutorenewIcon style={{ fontSize: 32, color: '#ff1fae', filter: 'drop-shadow(0 2px 6px #ff1fae33)' }} />
        </button>
      </Box>
      {/* Decorative background shapes removed */}
    </Box>
  );
}
