import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, CircularProgress, Alert, Divider, Stack, Chip, Link as MuiLink, Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery, LinearProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSearchParams } from 'react-router';
import { logger } from '@tumbaland/frontend-core';
import { readEmbedContext, toOrigin } from '@tumbaland/components';
import { paymentApi } from '../services/paymentApi';
import { ConfigContext } from '../config/ConfigProvider';
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
  const [termsOpen, setTermsOpen] = useState(false);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  // Read through the context directly: this page is rendered bare in tests,
  // where useConfig() would throw.
  const config = React.useContext(ConfigContext);
  // Inside our own shell the parent listens for navigate-top and drives the
  // redirect itself; any other embedder does not, so we escape the frame.
  const inShell = React.useMemo(() => readEmbedContext().embedded, []);
  const shellOrigin = React.useMemo(() => toOrigin(config?.SHELL_FRONT_URL), [config?.SHELL_FRONT_URL]);

  const formatPrice = (cents?: number) => (cents ? `${(cents/100).toFixed(2)} € / month` : 'Free');

  // Helper: safe top-level navigation when embedded in a cross-origin iframe.
  const navigateTop = (url: string) => {
    const absUrl = (() => {
      try { return new URL(url, window.location.origin).href; } catch { return url; }
    })();
    try {
      if (window.top && window.top !== window.self) {
        try {
          // Touching top.location on cross-origin will throw
          // If not thrown, we can navigate top directly
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          (window.top as Window).location.href;
          (window.top as Window).location.assign(absUrl);
          return;
        } catch {
          // Cross-origin: ask parent to navigate the top-level
          window.parent.postMessage({ source: 'payment-front', type: 'tumbaland:navigate-top', url: absUrl }, shellOrigin ?? '*');
          // Our shell acts on that message, so escaping the frame ourselves
          // would race it. Only fall through for embedders that don't listen.
          if (inShell) return;
          // Best-effort fallback: try opening in the top browsing context from user gesture
          // This often succeeds even when direct assignment is blocked in iframes
          const opened = window.open(absUrl, '_top');
          if (opened) return;
          // Last resort: synthetic anchor click with target _top
          const a = document.createElement('a');
          a.href = absUrl;
          a.target = '_top';
          a.rel = 'noopener noreferrer';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
      }
      // Not in iframe: regular same-tab navigation
      window.location.assign(absUrl);
    } catch {
      window.location.href = absUrl;
    }
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
          navigateTop('/subscription');
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

    tick();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [statusParam, sessionId, pollEnded]);

  const start = async () => {
    if (!plan) return;
    setCreating(true); setError(null);
    try {
      const res = await paymentApi.createCheckoutSession(plan.code);
      logger.debug('checkout-session response', res);
      if (res.free && res.subscription?.status === 'active') {
        const target = res.url || '/subscription';
        navigateTop(target);
        return;
      }
      const fallbackUrl = (!res.url && res.sessionId?.startsWith('cs_')) ? `https://checkout.stripe.com/c/${res.sessionId}` : res.url;
      if (fallbackUrl) {
        setRedirecting(true);
        // Redirect in the same tab (top-level if embedded) via parent message when cross-origin
        navigateTop(fallbackUrl);
      } else {
        // If neither free nor Stripe URL, navigate to subscription overview as safe default
        navigateTop('/subscription');
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
                        label={<Typography variant="caption">I agree to the <MuiLink href="#" onClick={(e: React.MouseEvent<HTMLAnchorElement>)=>{e.preventDefault(); setTermsOpen(true);}}>Terms and Conditions</MuiLink>.</Typography>}
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

        <Dialog open={termsOpen} onClose={()=>setTermsOpen(false)} maxWidth="md" fullWidth fullScreen={fullScreen}>
          <DialogTitle>Terms and Conditions</DialogTitle>
          <DialogContent dividers sx={{ maxHeight: { xs: '80vh', sm: '70vh' }, overflowY: 'auto' }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: 'block',
                mb: 2
              }}>
              Last updated: {new Date().toLocaleDateString()}
            </Typography>

            <Typography variant="body2" sx={{ mb: 2 }}>
              These Terms and Conditions ("Terms") govern your use of Tumbaland and its related services. By creating an account,
              purchasing a subscription, or using the service, you agree to be bound by these Terms.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>1. Subscriptions & Billing</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Paid plans are billed in advance on a recurring basis (monthly unless stated otherwise) and renew automatically until canceled.
              You can cancel at any time from your account. If you cancel, access remains until the end of the current billing period.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>2. Trials, Discounts, and Taxes</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Promotional offers may be available and are subject to change. Prices are shown inclusive/exclusive of taxes where applicable.
              You are responsible for any applicable taxes and fees.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>3. Refunds</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Except where required by law, payments are non-refundable. If you believe you were charged in error, contact support within 14 days.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>4. Acceptable Use</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              You agree not to misuse the service, including but not limited to: violating laws, infringing intellectual property,
              uploading harmful content, or attempting to disrupt or overload the service. We may suspend or terminate accounts that violate these Terms.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>5. Content & Privacy</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              You retain ownership of content you upload. You grant us a limited license to store and process content for the purpose of providing the service.
              We handle personal data in accordance with our Privacy Policy.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>6. Service Availability</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We strive for high availability but do not guarantee uninterrupted service. Features may change over time. We may perform maintenance with or without notice.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>7. Limitation of Liability</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              To the maximum extent permitted by law, Tumbaland and its affiliates will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or any loss of profits, data, or goodwill.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>8. Changes to Terms</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We may update these Terms from time to time. Material changes will be communicated. Continued use after changes constitutes acceptance.
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>9. Contact</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Questions? Contact support. You can also view these Terms at <MuiLink href="/terms" target="_blank" rel="noopener noreferrer">/terms</MuiLink>.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setTermsOpen(false)}>Close</Button>
            <Button variant="outlined" href="/terms" target="_blank" rel="noopener noreferrer">Open Full Page</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default SubscriptionCheckoutPage;
