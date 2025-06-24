import React from 'react';

export default function WelcomeCard() {
  return (
    <div style={{
      flex: 1,
      flexWrap: 'wrap',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '1.5rem',
        boxShadow: '0 8px 32px 0 rgba(99,102,241,0.10)',
        padding: '3rem',
        maxWidth: 1080,
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#1e293b', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-1px' }}>
          Welcome to Tumbaland
        </h1>
      </div>
    </div>
  );
}
