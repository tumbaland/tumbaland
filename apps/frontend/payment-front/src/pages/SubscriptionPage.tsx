import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Chip, Avatar, Divider } from '@mui/material';
import { paymentApi } from '../services/paymentApi';
import { Subscription } from '../types';
import { Loader } from '@tumbaland/components';
import { Subscriptions, CreditCard, Event, Cancel, Refresh } from '@mui/icons-material';

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
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cancel = async () => {
    setMessage(null);
    try {
      await paymentApi.cancelSubscription();
    } catch (e: unknown) {
      // The backend leaves the subscription untouched when Stripe rejects the cancel, so
      // surfacing the failure is what lets the user retry rather than assume it worked.
      setMessage(e instanceof Error ? e.message : 'Failed to cancel subscription');
      return;
    }
    load();
  };

  if (loading) return <Loader message="Loading subscription" fullHeight={false} />;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4, px: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          My Subscription
        </Typography>
        <Typography variant="body1" sx={{
          color: "text.secondary"
        }}>
          Manage your subscription and billing details
        </Typography>
      </Box>
      <Box sx={{ px: 2 }}>
        {message && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 2, color: 'error.contrastText' }}>
            {message}
          </Box>
        )}

        {sub ? (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              mb: 3,
              border: '1px solid',
              borderColor: 'divider',
              p: 3
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  width: 56,
                  height: 56
                }}
              >
                <CreditCard />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Current Plan: {sub.planCode}
                </Typography>
                <Chip
                  label={sub.status}
                  color={sub.status === 'active' ? 'success' : sub.status === 'canceling' ? 'warning' : 'default'}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 3 }}>
              {sub.renewsAt && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Event sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>
                    Renews: <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{new Date(sub.renewsAt).toLocaleDateString()}</Box>
                  </Typography>
                </Box>
              )}

              {sub.cancelAt && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Cancel sx={{ color: 'error.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{
                    color: "error.main"
                  }}>
                    Ends: {new Date(sub.cancelAt).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                color="error"
                disabled={sub.status === 'canceled' || sub.status === 'canceling'}
                onClick={cancel}
                startIcon={<Cancel />}
              >
                Cancel Subscription
              </Button>
              <Button
                variant="outlined"
                onClick={load}
                startIcon={<Refresh />}
              >
                Refresh
              </Button>
            </Box>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              textAlign: 'center',
              p: 6,
              mb: 3,
              border: '1px dashed',
              borderColor: 'divider',
              bgcolor: 'transparent'
            }}
          >
            <Subscriptions sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" gutterBottom sx={{
              color: "text.secondary"
            }}>
              No Active Subscription
            </Typography>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              You don't have an active subscription. Choose a plan to get started.
            </Typography>
          </Paper>
        )}

        {allSubs.filter(s => s._id !== sub?._id).length > 0 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              p: 3
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Subscription History
            </Typography>

            <TableContainer sx={{ boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Renews</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Canceled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allSubs.filter(s => s._id !== sub?._id).map(s => (
                    <TableRow key={s._id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <TableCell>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</TableCell>
                      <TableCell>
                        <Chip label={s.planCode} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={s.status}
                          size="small"
                          variant="outlined"
                          color={s.status === 'active' ? 'success' : s.status === 'canceled' ? 'error' : s.status === 'canceling' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{s.renewsAt ? new Date(s.renewsAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>{s.canceledAt ? new Date(s.canceledAt).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default SubscriptionPage;
