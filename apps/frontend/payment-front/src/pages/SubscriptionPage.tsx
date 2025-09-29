import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper, Chip, Avatar, Divider } from '@mui/material';
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', py: 2 }}>
      {/* Hero Header */}
      <Box
        sx={{
          textAlign: 'center',
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 3,
          p: 3,
          color: 'white'
        }}
      >
        <Subscriptions sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          My Subscription
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
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
          <Card sx={{ borderRadius: 3, overflow: 'hidden', mb: 3 }}>
            <Box
              sx={{
                height: 80,
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                <CreditCard sx={{ color: 'white' }} />
              </Avatar>
            </Box>

            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Current Plan: {sub.planCode}
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={sub.status}
                    color={sub.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {sub.renewsAt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Event sx={{ color: 'text.secondary', fontSize: 20 }} />
                    <Typography variant="body2">
                      Renews: {new Date(sub.renewsAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}

                {sub.cancelAt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Cancel sx={{ color: 'error.main', fontSize: 20 }} />
                    <Typography variant="body2" color="error.main">
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
                  disabled={sub.status === 'canceled'}
                  onClick={cancel}
                  startIcon={<Cancel />}
                  sx={{ borderRadius: 2 }}
                >
                  Cancel Subscription
                </Button>
                <Button
                  variant="outlined"
                  onClick={load}
                  startIcon={<Refresh />}
                  sx={{ borderRadius: 2 }}
                >
                  Refresh
                </Button>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 4, mb: 3 }}>
            <Subscriptions sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Active Subscription
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You don't have an active subscription. Choose a plan to get started.
            </Typography>
          </Card>
        )}

        {allSubs.filter(s => s._id !== sub?._id).length > 0 && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Subscription History
              </Typography>

              <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Renews</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Canceled</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allSubs.filter(s => s._id !== sub?._id).map(s => (
                      <TableRow key={s._id} sx={{ '&:hover': { bgcolor: 'grey.25' } }}>
                        <TableCell>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</TableCell>
                        <TableCell>
                          <Chip label={s.planCode} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={s.status}
                            size="small"
                            color={s.status === 'active' ? 'success' : s.status === 'canceled' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{s.renewsAt ? new Date(s.renewsAt).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{s.canceledAt ? new Date(s.canceledAt).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default SubscriptionPage;
