import React, { useEffect, useState } from 'react';
import { Box, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Chip } from '@mui/material';
import { paymentApi } from '../services/paymentApi';
import { Subscription } from '../types';
import { Loader } from '../components/Loader';

const statusColor: Record<string,string> = { active: 'success', past_due: 'warning', incomplete: 'info', canceled: 'default' };

const AllSubscriptionsPage: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    paymentApi.listMySubscriptions()
      .then(setSubs)
      .catch(e => setError(e.message || 'Failed'))
      .finally(()=> setLoading(false));
  }, []);

  if (loading) return <Loader message="Loading subscriptions" />;
  if (error) return <Box sx={{ py:4 }}>{error}</Box>;

  return (
    <Box sx={{ py:4 }}>
      <Typography variant="h4" gutterBottom>All Subscriptions</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Created</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Renews</TableCell>
              <TableCell>Canceled At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subs.map(s => (
              <TableRow key={s._id}>
                <TableCell>{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</TableCell>
                <TableCell>{s.planCode}</TableCell>
                <TableCell><Chip size="small" color={statusColor[s.status] as any || 'default'} label={s.status} /></TableCell>
                <TableCell>{s.renewsAt ? new Date(s.renewsAt).toLocaleString() : '-'}</TableCell>
                <TableCell>{s.canceledAt ? new Date(s.canceledAt).toLocaleString() : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AllSubscriptionsPage;
