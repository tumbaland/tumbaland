import React, { useEffect, useState } from 'react';
import { Box, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper, Chip } from '@mui/material';
import { paymentApi } from '../services/paymentApi';
import { Payment } from '../types';
import { Loader } from '@tumbaland/components';
import { CreditCard, CheckCircle, Error, Schedule } from '@mui/icons-material';

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

  if (loading) return <Loader message="Loading payments" fullHeight={false} />;
  if (error) return <Box sx={{ mt:4, textAlign: 'center' }}>Error loading payments: {error}</Box>;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4, px: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          Payment History
        </Typography>
        <Typography variant="body1" sx={{
          color: "text.secondary"
        }}>
          View all your past payments and transactions
        </Typography>
      </Box>
      <Box sx={{ px: 2 }}>
        {payments.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 6,
              borderRadius: 3,
              border: '1px dashed',
              borderColor: 'divider',
              bgcolor: 'transparent'
            }}
          >
            <CreditCard sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" gutterBottom sx={{
              color: "text.secondary"
            }}>
              No Payment History
            </Typography>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              Your payment history will appear here once you make transactions.
            </Typography>
          </Paper>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, py: 2, color: 'text.secondary' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 2, color: 'text.secondary' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 2, color: 'text.secondary' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 600, py: 2, color: 'text.secondary' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => {
                  const getStatusIcon = (status: string) => {
                    switch (status?.toLowerCase()) {
                      case 'completed':
                      case 'succeeded':
                        return <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />;
                      case 'failed':
                      case 'error':
                        return <Error sx={{ color: 'error.main', fontSize: 18 }} />;
                      case 'pending':
                        return <Schedule sx={{ color: 'warning.main', fontSize: 18 }} />;
                      default:
                        return <CreditCard sx={{ color: 'text.secondary', fontSize: 18 }} />;
                    }
                  };

                  const getStatusColor = (status: string) => {
                    switch (status?.toLowerCase()) {
                      case 'completed':
                      case 'succeeded':
                        return 'success';
                      case 'failed':
                      case 'error':
                        return 'error';
                      case 'pending':
                        return 'warning';
                      default:
                        return 'default';
                    }
                  };

                  return (
                    <TableRow key={p._id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <TableCell sx={{ py: 2 }}>
                        {new Date(p.createdAt || '').toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip
                          label={p.type}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 2, fontWeight: 600 }}>
                        {typeof p.amountCents === 'number'
                          ? `${(p.amountCents / 100).toFixed(2)} ${(p.currency || 'EUR').toUpperCase()}`
                          : '—'
                        }
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getStatusIcon(p.status || '')}
                          <Chip
                            label={p.status}
                            size="small"
                            variant="outlined"
                            color={getStatusColor(p.status || '')}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default PaymentsHistoryPage;
