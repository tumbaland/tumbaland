import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Chip } from '@mui/material';
import { paymentApi } from '../services/paymentApi';
import { Subscription } from '../types';
import { Loader } from '@tumbaland/components';

const SubscriptionPage: React.FC = () => {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [allSubs, setAllSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      paymentApi.getMySubscription(),
      paymentApi.listMySubscriptions().catch(() => [])
    ])
      .then(([s, list]) => {
        setSub(s);
        setAllSubs(Array.isArray(list) ? list : []);
      })
      .catch((e: any) => setMessage(e.message || 'Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cancel = async () => {
    await paymentApi.cancelSubscription();
    load();
  };

  if (loading) return <Loader message="Loading subscription" fullHeight={false} />;

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>My Subscription</Typography>
      {message && <Typography sx={{ mb:2 }} color="error">{message}</Typography>}
      {sub ? (
        <Card>
          <CardContent>
            <Typography variant="h6">Plan: {sub.planCode}</Typography>
            <Typography>Status: {sub.status}</Typography>
            {sub.renewsAt && <Typography>Renews: {new Date(sub.renewsAt).toLocaleString()}</Typography>}
            {sub.cancelAt && <Typography>Will end: {new Date(sub.cancelAt).toLocaleString()}</Typography>}
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button variant="outlined" disabled={sub.status === 'canceled'} onClick={cancel}>Cancel Subscription</Button>
              <Button variant="text" onClick={load}>Refresh</Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Typography>No active subscription.</Typography>
      )}
      {allSubs.filter(s => s._id !== sub?._id).length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Previous / Other Subscriptions</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Created</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Renews</TableCell>
                  <TableCell>Canceled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allSubs.filter(s => s._id !== sub?._id).map(s => (
                  <TableRow key={s._id}>
                    <TableCell>{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</TableCell>
                    <TableCell>{s.planCode}</TableCell>
                    <TableCell><Chip size="small" label={s.status} /></TableCell>
                    <TableCell>{s.renewsAt ? new Date(s.renewsAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{s.canceledAt ? new Date(s.canceledAt).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default SubscriptionPage;
