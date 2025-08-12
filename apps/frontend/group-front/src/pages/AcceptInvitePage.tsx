import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { groupApi } from '../services/groupApi';

const AcceptInvitePage = () => {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const id = search.get('id');
    const token = search.get('token');
    const accept = async () => {
      try {
        await groupApi.acceptInvite(id!, token!);
        setStatus('success');
      } catch {
        setStatus('error');
      }
    };
    if (id && token) accept();
  }, [search]);

  if (status === 'pending') return <Box sx={{ p: 3 }}>Accepting invite...</Box>;
  if (status === 'error') return <Box sx={{ p: 3 }}>Invalid or expired invite.</Box>;
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6">You joined the group!</Typography>
      <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/')}>Go to My Groups</Button>
    </Box>
  );
};

export default AcceptInvitePage;
