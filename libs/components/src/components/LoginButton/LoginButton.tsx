import { Button } from '@mui/material';
import { Login } from '@mui/icons-material';

export interface LoginButtonProps {
  onClick: () => void;
  text?: string;
}

export function LoginButton({
  onClick,
  text = ''
}: LoginButtonProps) {
  return (
    <Button
      color="inherit"
      onClick={onClick}
      startIcon={<Login />}
      size={'large'}
      sx={{
        backgroundColor: 'transparent',
        border: 'none',
        minWidth: 'auto',
        padding: '8px',
        textTransform: 'none',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {text}
    </Button>
  );
}