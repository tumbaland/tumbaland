import React, { useEffect, useState } from 'react';
import { Box, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper } from '@mui/material';
import { paymentApi } from '../services/paymentApi';
import { Payment } from '../types';
import { Loader } from '../components/Loader';

const PaymentsHistoryPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    paymentApi
      .listMyPayments()
      .then((res: Payment[]) => setPayments(res))
      .catch((e: any) => setError(e.message || 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader message="Loading payments" />;
  if (error) return <Box sx={{ mt:4, textAlign: 'center' }}>Error loading payments: {error}</Box>;

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Payment History</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p._id}>
                <TableCell>{new Date(p.createdAt || '').toLocaleString()}</TableCell>
                <TableCell>{p.type}</TableCell>
                <TableCell>{typeof p.amountCents === 'number' ? `${(p.amountCents/100).toFixed(2)} ${(p.currency || 'EUR').toUpperCase()}` : '-'}</TableCell>
                <TableCell>{p.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PaymentsHistoryPage;
