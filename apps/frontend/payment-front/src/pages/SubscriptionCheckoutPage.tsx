import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
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
    let timer: any;

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
          (window.top || window).location.href = '/subscription';
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
        console.error('poll error', e);
        if (attempts > 5) {
          finishWithError('Network issue while checking status. Please retry later.');
          return;
        }
      }
      schedule();
    };

    tick();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [statusParam, sessionId, pollEnded]);

  const start = async () => {
    if (!plan) return;
    setCreating(true); setError(null);
    try {
      const res = await paymentApi.createCheckoutSession(plan.code);
      // Debug log of raw response for troubleshooting missing URL
      // (Remove or guard behind env flag in production)
      // eslint-disable-next-line no-console
      console.debug('checkout-session response', res);
      if (res.free && res.subscription?.status === 'active') {
        const target = (res as any).url || '/subscription';
        window.location.href = target;
        return;
      }
      const fallbackUrl = (!res.url && res.sessionId?.startsWith('cs_')) ? `https://checkout.stripe.com/c/${res.sessionId}` : res.url;
      if (fallbackUrl) {
        setRedirecting(true);
        // Open in new tab so we escape any embedding iframe in shell front.
        const win = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
          // Popup blocked; fallback to top-level redirect
          (window.top || window).location.href = fallbackUrl;
        }
      } else {
        // If neither free nor Stripe URL, navigate to subscription overview as safe default
        (window.top || window).location.href = '/subscription';
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start checkout');
    } finally { setCreating(false); }
  };


  if (plansLoading) return <Box sx={{ py:4, display:'flex', justifyContent:'center' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ py:4 }}><Alert severity="error">{error}</Alert></Box>;
  if (!plan && planCode) return <Box sx={{ py:4 }}><Alert severity="warning">Plan not found.</Alert></Box>;

  return (
    <Box sx={{ py:4 }}>
      <Typography variant="h4" gutterBottom>Checkout</Typography>
      <Card sx={{ maxWidth: 480 }}>
        <CardContent>
          {plan ? (
            <>
              <Typography variant="h6">{plan.name}</Typography>
              {plan.description && <Typography variant="body2" color="text.secondary" sx={{ mb:1 }}>{plan.description}</Typography>}
              <Typography variant="h3" sx={{ my:1 }}>{plan.priceMonthlyCents ? `${(plan.priceMonthlyCents/100).toFixed(2)} €/mo` : 'Free'}</Typography>
            </>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ mb:1 }}>Finalizing checkout...</Typography>
          )}
          {statusParam === 'success' && sessionId ? (
            <Alert severity="info">Processing payment... your subscription will activate shortly.</Alert>
          ) : statusParam === 'cancel' ? (
            <Alert severity="warning" sx={{ mb:2 }}>Payment canceled. You can try again.</Alert>
          ) : (
            plan ? (
              <Button variant="contained" onClick={start} disabled={creating || redirecting}>
                {redirecting ? 'Redirecting...' : creating ? 'Creating session...' : (plan.priceMonthlyCents ? 'Proceed to Payment' : 'Activate Free Plan')}
              </Button>
            ) : (
              <Alert severity="info">Loading plan details...</Alert>
            )
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubscriptionCheckoutPage;
