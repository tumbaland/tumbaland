import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';

const API_URL = import.meta.env.VITE_PUBLIC_API_URL || 'http://localhost:4000';

export default function WelcomeCard() {
  const [todo, setTodo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/todo/random`)
      .then(res => res.json())
      .then((data: { todo: string }) => {
        if (data && data.todo) {
          setTodo(data.todo);
        }
      });
  }, []);

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
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
          color: '#374151',
          margin: '24px 0 16px 0',
          minHeight: 48
        }}>
          {todo || 'Loading...'}
        </p>
        <button
          aria-label="Get new todo"
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
            marginTop: 8,
            padding: 0,
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px 0 rgba(99,102,241,0.18)',
            cursor: 'pointer',
            transition: 'background 0.2s, transform 0.1s',
            outline: 'none',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)')}
          onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)')}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <CasinoIcon style={{ fontSize: 32, color: 'white', filter: 'drop-shadow(0 2px 6px #6366f155)' }} />
        </button>
      </Box>
      {/* Decorative background shapes */}
      <Box sx={{
        position: 'absolute',
        top: -120,
        left: -120,
        width: 320,
        height: 320,
        bgcolor: 'primary.light',
        opacity: 0.18,
        borderRadius: '50%',
        zIndex: 0,
        filter: 'blur(12px)'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: -100,
        right: -100,
        width: 260,
        height: 260,
        bgcolor: 'secondary.light',
        opacity: 0.15,
        borderRadius: '50%',
        zIndex: 0,
        filter: 'blur(10px)'
      }} />
    </Box>
  );
}
