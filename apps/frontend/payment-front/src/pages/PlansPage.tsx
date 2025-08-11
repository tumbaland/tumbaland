import React, { useEffect, useState } from 'react';
import { Box, Card, CardActions, CardContent, Button, Typography, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { paymentApi } from '../services/paymentApi';
import { Plan, Subscription } from '../types';
import { Loader } from '../components/Loader';

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
      } catch (e: any) {
        setError(e.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader message="Loading plans" />;
  if (error) return <Box sx={{ mt: 4, textAlign: 'center' }}>Error loading plans: {error}</Box>;

  // Derive simple feature matrix; real implementation could come from backend with structured attributes
  const featureMatrix: { key: string; label: string; tooltip?: string; tiers: Record<string, string | boolean>; }[] = [
    { key: 'uploads', label: 'Daily uploads', tiers: { free: '5', pro: '100', elite: '1000+' } },
    { key: 'storage', label: 'Storage', tiers: { free: '0.5 GB', pro: '50 GB', elite: '500 GB+' } },
    { key: 'privacy', label: 'Private content', tiers: { free: false, pro: true, elite: true } },
    { key: 'history', label: 'History retention', tiers: { free: '30d', pro: '1 year', elite: 'Full' } },
    { key: 'ai', label: 'AI / Automation', tiers: { free: 'Limited', pro: 'Standard', elite: 'Advanced' } },
    { key: 'collab', label: 'Collaborators', tiers: { free: 'Solo', pro: '2', elite: 'Team (10)' } },
  ];

  // Helper map for quick access
  const matrixByKey = Object.fromEntries(featureMatrix.map(r => [r.key, r]));
  const tierAlias = (code: string) => {
    const c = code.toLowerCase();
    if (/(^|-)starter|free/.test(c)) return 'free';
    if (/(pro)/.test(c)) return 'pro';
    if (/(elite|max)/.test(c)) return 'elite';
    return 'free'; // default fallback
  };
  const cardFeatureOrder = ['uploads','storage','privacy','history','ai','collab'];
  const renderValue = (key: string, planCode: string) => {
    const tier = tierAlias(planCode);
    const row = matrixByKey[key];
    if (!row) return '—';
    const v = row.tiers[tier];
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return v || '—';
  };


  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Choose a Plan</Typography>
      <Typography variant="body1" sx={{ mb: 3, maxWidth: 860 }}>
        Pick the plan that matches your current stage. You can upgrade or downgrade anytime. Higher tiers unlock more capacity, privacy, monetization and performance.
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          mb: 5,
          justifyContent: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'stretch' },
        }}
      >
        {plans.map((plan: Plan) => {
          const alias = tierAlias(plan.code);
          return (
            <Box key={plan._id || plan.code} sx={{ flex: '1 1 280px', maxWidth: 360 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6">
                    {plan.name}
                  </Typography>
                  <Typography variant="h4" sx={{ my: 1 }}>
                    {plan.priceMonthlyCents ? `${(plan.priceMonthlyCents / 100).toFixed(2) } €/mo` : 'Free'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box component="ul" sx={{ pl: 2, m: 0, mb: 1, listStyle: 'disc', fontSize: 13, display: 'grid', gap: 0.5 }}>
                    {cardFeatureOrder.map(k => (
                      <li key={k} style={{ marginLeft: '1em' }}>
                        <strong>{matrixByKey[k].label}:</strong> {renderValue(k, alias)}
                      </li>
                    ))}
                    {alias === 'elite' ? (
                      <li style={{ marginLeft: '1em' }}>
                        <strong>Exclusive Award:</strong> TumbaBubu plush 🧸
                      </li>
                    ) : (
                      <li style={{ marginLeft: '1em', opacity: 0.7 }}>
                        <strong>Exclusive Award:</strong> —
                      </li>
                    )}
                  </Box>
                </CardContent>
                <CardActions>
                  {subscription?.planCode === plan.code ? (
                    <Button fullWidth variant="outlined" disabled>
                      {plan.priceMonthlyCents ? 'Current Plan' : 'Already on Free'}
                    </Button>
                  ) : plan.priceMonthlyCents === 0 && subscription && (subscription.planCode !== plan.code) ? (
                    <Button fullWidth variant="text" onClick={() => navigate(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`)}>
                      Switch to Free
                    </Button>
                  ) : (
                    <Button fullWidth variant="contained" onClick={() => navigate(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`)}>
                      {subscription ? 'Change To This Plan' : 'Select'}
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};


export default PlansPage;
