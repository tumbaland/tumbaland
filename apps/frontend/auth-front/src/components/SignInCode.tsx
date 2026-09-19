import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';

interface ShowCodeProps {
  code: string;
}

/**
 * Shown in the window where Google's sign-in finished, when that window is not
 * the app (the Safari sheet on an iPhone home-screen app).
 */
export const ShowSignInCode: React.FC<ShowCodeProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // The code is still on screen to type by hand.
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
        Almost there
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        Copy this code, close this window, go back to the Tumbaland app and paste it there:
      </Typography>
      <Typography
        data-testid="signin-code"
        sx={{ fontSize: 40, fontWeight: 700, letterSpacing: '0.3em', color: '#1e293b', mb: 2 }}
      >
        {code}
      </Typography>
      <Button variant="contained" fullWidth onClick={copy} sx={{ mb: 2 }}>
        {copied ? 'Copied' : 'Copy code'}
      </Button>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        The code works for 5 minutes.
      </Typography>
    </Box>
  );
};

interface EnterCodeProps {
  onSubmit: (code: string) => void;
  submitting: boolean;
  error?: string | null;
}

/** Shown in the app once a sign-in is waiting to be collected. */
export const EnterSignInCode: React.FC<EnterCodeProps> = ({ onSubmit, submitting, error }) => {
  const [code, setCode] = useState('');
  const complete = /^\d{6}$/.test(code);
  const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);

  const paste = async () => {
    try {
      const digits = (await navigator.clipboard.readText()).replace(/\D/g, '').slice(0, 6);
      setCode(digits);
      if (/^\d{6}$/.test(digits)) onSubmit(digits);
    } catch {
      // Clipboard access refused; the field still takes typing or a long-press paste.
    }
  };

  return (
    <Box
      component="form"
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        if (complete) onSubmit(code);
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
        Enter your code
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        Paste or type the 6-digit code shown after you signed in with Google.
      </Typography>
      <TextField
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        autoFocus
        fullWidth
        label="Code"
        slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code' } }}
        sx={{ mb: 2 }}
      />
      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {canPaste && (
        <Button variant="outlined" fullWidth onClick={paste} disabled={submitting} sx={{ mb: 1 }}>
          Paste code
        </Button>
      )}
      <Button type="submit" variant="contained" fullWidth disabled={!complete || submitting}>
        {submitting ? 'Signing in...' : 'Continue'}
      </Button>
    </Box>
  );
};
