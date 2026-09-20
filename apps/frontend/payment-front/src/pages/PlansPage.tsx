import React, { useEffect, useState } from 'react';
import { Box, Card, CardActions, CardContent, Button, Typography, Divider, Avatar, Chip } from '@mui/material';
import { useNavigate } from 'react-router';
import { paymentApi } from '../services/paymentApi';
import { Plan, Subscription } from '../types';
import { Loader } from '@tumbaland/frontend-core';
import { Star, CheckCircle } from '@mui/icons-material';
import { appPath } from '../appBase';

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, subRes] = await Promise.all([
          paymentApi.listPlans(),
          paymentApi.getMySubscription().catch(() => null)
        ]);
        setPlans(plansRes);
        setSubscription(subRes);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader message="Loading plans" fullHeight={false} />;
  if (error) return <Box sx={{ mt: 4, textAlign: 'center' }}>Error loading plans: {error}</Box>;

  // A non-public plan reaches this page only when the caller is on it, so its
  // presence identifies a granted account. Buying anything while on one would
  // change nothing — a comp grant outranks a purchased plan — so the other
  // cards say so instead of offering a checkout that has no effect.
  const grantedPlan = plans.find(plan => plan.isPublic === false);
  const onGrantedPlan = Boolean(grantedPlan && subscription?.planCode === grantedPlan.code);

  // Everything shown on a card comes from the plan document itself. The page previously
  // rendered a hardcoded matrix of upload/storage/retention/collaborator limits mapped onto
  // plan codes by regex — none of which is enforced anywhere in the product. Advertising
  // limits that don't exist is the one thing here with legal exposure attached, so the card
  // shows only what the plan actually says about itself.
  return (
    <Box sx={{ maxWidth: 1320, mx: 'auto', py: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4, px: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
          Choose Your Plan
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: "text.secondary",
            maxWidth: 600,
            mx: 'auto'
          }}>
          Pick the plan that matches your current stage. You can upgrade or downgrade anytime.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          // One column per plan on desktop, however many there are: a staff
          // member sees four cards and a customer three, and a fixed
          // `repeat(3, ...)` would drop the fourth onto a lonely second row.
          // `minmax(0, 1fr)` rather than `1fr` so long feature text shrinks the
          // column instead of overflowing it.
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: `repeat(${plans.length || 1}, minmax(0, 1fr))`
          },
          gap: 3,
          px: 2
        }}
      >
        {plans.map((plan: Plan) => {
          const isFree = !plan.priceMonthlyCents;
          const isCurrentPlan = subscription?.planCode === plan.code;
          const features = plan.features ?? [];
          // The API returns a non-public plan only to someone who is on it, so
          // its presence here means it is this user's plan. It cannot be bought,
          // so it gets a badge instead of a call to action.
          const isGrantedPlan = plan.isPublic === false;

          return (
            <Card
              key={plan._id || plan.code}
              elevation={0}
              sx={{
                position: 'relative',
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                border: '1px solid',
                borderColor: isCurrentPlan ? 'primary.main' : 'divider',
                bgcolor: 'background.paper',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: isFree ? 'grey.100' : 'primary.light',
                      color: isFree ? 'grey.700' : 'primary.main',
                      width: 48,
                      height: 48
                    }}
                  >
                    {isFree ? <Star /> : <CheckCircle />}
                  </Avatar>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {plan.name}
                      </Typography>
                      {isGrantedPlan && (
                        <Chip label="Granted" size="small" color="secondary" variant="outlined" />
                      )}
                    </Box>
                    {plan.description && (
                      <Typography variant="caption" sx={{
                        color: "text.secondary"
                      }}>
                        {plan.description}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
                  {isGrantedPlan ? 'Complimentary' : plan.priceMonthlyCents ? `${(plan.priceMonthlyCents / 100).toFixed(2)} €` : 'Free'}
                  {(plan.priceMonthlyCents || 0) > 0 && <Typography component="span" variant="body2" sx={{
                    color: "text.secondary"
                  }}>/mo</Typography>}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {features.length > 0 ? features.map(feature => (
                    <Box key={feature} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <CheckCircle sx={{ fontSize: 18, mt: '2px', color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
                        {feature}
                      </Typography>
                    </Box>
                  )) : (
                    <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                      No features listed for this plan yet.
                    </Typography>
                  )}
                </Box>
              </CardContent>
              <CardActions sx={{ p: 3, pt: 0 }}>
                {isCurrentPlan ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled
                    sx={{
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      '&.Mui-disabled': {
                        borderColor: 'primary.main',
                        color: 'primary.main'
                      }
                    }}
                  >
                    Current Plan
                  </Button>
                ) : onGrantedPlan ? (
                  <Button fullWidth variant="outlined" disabled>
                    Covered by {grantedPlan?.name}
                  </Button>
                ) : plan.priceMonthlyCents === 0 && subscription && (subscription.planCode !== plan.code) ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(appPath(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`))}
                  >
                    Switch to Free
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(appPath(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`))}
                    color="primary"
                  >
                    {subscription ? 'Change Plan' : 'Get Started'}
                  </Button>
                )}
              </CardActions>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};


export default PlansPage;
