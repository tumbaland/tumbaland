import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, CircularProgress, Alert, Divider, Stack, Chip, Link as MuiLink, Checkbox, FormControlLabel, LinearProgress } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSearchParams } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { paymentApi } from '../services/paymentApi';
import { Plan } from '../types';

// Placeholder: fetch plans & show chosen plan, then user clicks "Confirm & Pay" which calls startSubscription
// Later replace with Stripe session creation + redirect.

const SubscriptionCheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const planCode = searchParams.get('plan');
  const statusParam = searchParams.get('status');
  const sessionId = searchParams.get('session_id');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [pollEnded, setPollEnded] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const formatPrice = (cents?: number) => (cents ? `${(cents / 100).toFixed(2)} € / month` : 'Free');

  /**
   * Leaves for Stripe.
   *
   * This used to be forty lines of escaping a cross-origin iframe: touching
   * `window.top.location`, posting `tumbaland:navigate-top` to the shell,
   * opening `_top`, then a synthetic anchor as a last resort. Billing is a
   * module-federation remote now and runs in the shell's own page, so
   * `window.top` is this window and a plain redirect is the whole job.
   */
  const leaveForCheckout = (url: string) => {
    const absolute = (() => {
      try {
        return new URL(url, window.location.origin).href;
      } catch {
        return url;
      }
    })();
    window.location.assign(absolute);
  };

  useEffect(() => {
    if (!planCode) {
      // If returning from success without plan param, don't block page; skip plan display.
      setPlansLoading(false);
      return;
    }
    paymentApi.listPlans()
      .then(ps => { setPlan(ps.find(p => p.code === planCode) || null); })
      .catch(e => setError(e.message || 'Failed to load plan'))
      .finally(() => setPlansLoading(false));
  }, [planCode]);

  // Poll subscription status after returning from Stripe success (with backoff & end conditions)
  useEffect(() => {
    if (pollEnded) return; // already finished
    if (!(statusParam === 'success' && sessionId)) return;
    let attempts = 0;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!active) return;
      // Backoff: 0-5 =>2s, 6-15 =>5s, 16-30 =>10s
      let delay = 2000;
      if (attempts > 15) delay = 10000; else if (attempts > 5) delay = 5000;
      timer = setTimeout(tick, delay);
    };

    const finishWithError = (msg: string) => {
      if (!active) return;
      active = false;
      setError(msg);
    };

    const tick = async () => {
      attempts++;
      try {
        const res = await paymentApi.getCheckoutSessionStatus(sessionId);
        // If subscription activated -> redirect
        if (res.subscription && res.subscription.status === 'active') {
          active = false;
          setPollEnded(true);
          // Use top-level redirect in case we are inside an iframe shell
          leaveForCheckout('/subscription');
          return;
        }
        // If Stripe session itself reaches a terminal status (complete / expired) but sub not active yet
        if (res.status === 'complete' && attempts >= 3) {
          // Give up polling quickly if webhook likely missed; let user manually refresh later
            finishWithError('Payment completed, awaiting confirmation. If not active soon, refresh or contact support.');
            return;
        }
        if (attempts >= 30) { // ~ (5*2s + 10*5s + 15*10s) ≈ 200s max
    finishWithError('Still processing after several minutes. We will email you when activated.');
          return;
        }
      } catch (e) {
        logger.error('poll error', e);
        if (attempts > 5) {
          finishWithError('Network issue while checking status. Please retry later.');
          return;
        }
      }
      schedule();
    };

    void tick();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [statusParam, sessionId, pollEnded]);

  const start = async () => {
    if (!plan) return;
    setCreating(true); setError(null);
    try {
      const res = await paymentApi.createCheckoutSession(plan.code);
      logger.debug('checkout-session response', res);
      // Free activation, or a switch applied to the subscription they already
      // have: both are already done server-side, so there is nothing to check
      // out — go straight to the subscription page showing the new plan.
      if ((res.free || res.changed) && res.subscription?.status === 'active') {
        const target = res.url || '/subscription';
        leaveForCheckout(target);
        return;
      }
      const fallbackUrl = (!res.url && res.sessionId?.startsWith('cs_')) ? `https://checkout.stripe.com/c/${res.sessionId}` : res.url;
      if (fallbackUrl) {
        setRedirecting(true);
        // Redirect in the same tab (top-level if embedded) via parent message when cross-origin
        leaveForCheckout(fallbackUrl);
      } else {
        // If neither free nor Stripe URL, navigate to subscription overview as safe default
        leaveForCheckout('/subscription');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
    } finally { setCreating(false); }
  };


  if (plansLoading) return <Box sx={{ py:6, display:'flex', justifyContent:'center' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ py:6, maxWidth: 720, mx: 'auto' }}><Alert severity="error">{error}</Alert></Box>;
  if (!plan && planCode) return <Box sx={{ py:6, maxWidth: 720, mx: 'auto' }}><Alert severity="warning">Plan not found.</Alert></Box>;

  return (
    <Box sx={{ py: 5 }}>
      <Box sx={{ maxWidth: 980, mx: 'auto', px: 2 }}>
        <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>Checkout</Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 3
          }}>
          Secure payment powered by Stripe. Change or cancel anytime.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 3 }}>
          <Box>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                {plan ? (
                  <Stack spacing={2}>
                    <Typography variant="overline" sx={{
                      color: "text.secondary"
                    }}>Order Summary</Typography>
                    <Box>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}>
                        <Typography variant="h6">{plan.name}</Typography>
                        <Chip color={plan.priceMonthlyCents ? 'primary' : 'success'} label={plan.priceMonthlyCents ? 'Paid plan' : 'Free'} size="small" />
                      </Stack>
                      {plan.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            mt: 0.5
                          }}>{plan.description}</Typography>
                      )}
                    </Box>
                    <Box>
                      <Typography variant="h3" sx={{ mt: 1 }}>{formatPrice(plan.priceMonthlyCents)}</Typography>
                      {!!plan.priceMonthlyCents && (
                        <Typography variant="caption" sx={{
                          color: "text.secondary"
                        }}>Billed monthly • VAT may apply at checkout</Typography>
                      )}
                    </Box>
                    <Divider />
                    <Stack spacing={1.2}>
                      <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                      }}>
                        <CheckCircleOutlinedIcon color="success" fontSize="small" />
                        <Typography variant="body2">Instant activation after payment</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                      }}>
                        <CheckCircleOutlinedIcon color="success" fontSize="small" />
                        <Typography variant="body2">Cancel anytime from your account</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                      }}>
                        <CheckCircleOutlinedIcon color="success" fontSize="small" />
                        <Typography variant="body2">Email receipts and billing history</Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body1" sx={{
                    color: "text.secondary"
                  }}>Finalizing checkout...</Typography>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ position: { md: 'sticky' }, top: { md: 24 } }}>
            <Card elevation={3}>
              <CardContent>
                <Stack spacing={2}>
                  {statusParam === 'success' && sessionId ? (
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                      }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">Processing payment…</Typography>
                      </Stack>
                      <Alert severity="info">Your subscription will activate shortly.</Alert>
                    </Stack>
                  ) : statusParam === 'cancel' ? (
                    <Alert severity="warning">Payment canceled. You can try again.</Alert>
                  ) : plan ? (
                    <Button variant="contained" size="large" onClick={start} disabled={creating || redirecting || (!!plan.priceMonthlyCents && !acceptedTerms)} fullWidth>
                      {redirecting ? 'Redirecting…' : creating ? 'Creating session…' : (plan.priceMonthlyCents ? 'Proceed to Payment' : 'Activate Free Plan')}
                    </Button>
                  ) : (
                    <Alert severity="info">Loading plan details…</Alert>
                  )}

                  {(creating || redirecting) && <LinearProgress />}

                  <Divider />
                  {!!plan?.priceMonthlyCents && (
                    <Stack spacing={1}>
                      <FormControlLabel
                        control={<Checkbox checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />}
                        label={<Typography variant="caption">I agree to the <MuiLink href="/terms" target="_blank" rel="noopener noreferrer">Terms</MuiLink>.</Typography>}
                      />
                      <Typography variant="caption" sx={{
                        color: "text.secondary"
                      }}>You must accept the Terms to proceed with payment.</Typography>
                    </Stack>
                  )}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      color: 'text.secondary'
                    }}>
                    <LockOutlinedIcon fontSize="small" />
                    <Typography variant="caption">Secure checkout by Stripe. We never store your card details.</Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      color: 'text.secondary'
                    }}>
                    <SupportAgentIcon fontSize="small" />
                    <Typography variant="caption">Need help? Contact support.</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

export default SubscriptionCheckoutPage;
