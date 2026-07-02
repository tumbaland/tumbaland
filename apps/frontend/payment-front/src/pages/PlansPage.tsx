import React, { useEffect, useState } from 'react';
import { Box, Card, CardActions, CardContent, Button, Typography, Divider, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { paymentApi } from '../services/paymentApi';
import { Plan, Subscription } from '../types';
import { Loader } from '@tumbaland/components';
import { Star, CheckCircle, Storage, CloudUpload, People, History, SmartToy } from '@mui/icons-material';

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

  if (loading) return <Loader message="Loading plans" fullHeight={false} />;
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
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
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
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 3,
          px: 2
        }}
      >
        {plans.map((plan: Plan) => {
          const alias = tierAlias(plan.code);
          const isCurrentPlan = subscription?.planCode === plan.code;
          const isPopular = alias === 'pro';

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
              {isPopular && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    zIndex: 1
                  }}
                >
                  POPULAR
                </Box>
              )}
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: alias === 'free' ? 'grey.100' : alias === 'pro' ? 'primary.light' : 'secondary.light',
                      color: alias === 'free' ? 'grey.700' : alias === 'pro' ? 'primary.main' : 'secondary.main',
                      width: 48,
                      height: 48
                    }}
                  >
                    {alias === 'free' ? <Star /> : alias === 'pro' ? <CheckCircle /> : <SmartToy />}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="caption" sx={{
                      color: "text.secondary"
                    }}>
                      {alias === 'free' ? 'For starters' : alias === 'pro' ? 'For professionals' : 'For power users'}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
                  {plan.priceMonthlyCents ? `${(plan.priceMonthlyCents / 100).toFixed(2)} €` : 'Free'}
                  {(plan.priceMonthlyCents || 0) > 0 && <Typography component="span" variant="body2" sx={{
                    color: "text.secondary"
                  }}>/mo</Typography>}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {cardFeatureOrder.map(k => {
                    const icon = k === 'uploads' ? <CloudUpload sx={{ fontSize: 18, color: 'text.secondary' }} /> :
                               k === 'storage' ? <Storage sx={{ fontSize: 18, color: 'text.secondary' }} /> :
                               k === 'privacy' ? <CheckCircle sx={{ fontSize: 18, color: 'text.secondary' }} /> :
                               k === 'history' ? <History sx={{ fontSize: 18, color: 'text.secondary' }} /> :
                               k === 'ai' ? <SmartToy sx={{ fontSize: 18, color: 'text.secondary' }} /> :
                               <People sx={{ fontSize: 18, color: 'text.secondary' }} />;

                    return (
                      <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {icon}
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            flex: 1
                          }}>
                          <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{matrixByKey[k].label}:</Box> {renderValue(k, alias)}
                        </Typography>
                      </Box>
                    );
                  })}

                  {alias === 'elite' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
                      <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main' }}>
                        Exclusive Award: TumbaBubu plush 🧸
                      </Typography>
                    </Box>
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
                ) : plan.priceMonthlyCents === 0 && subscription && (subscription.planCode !== plan.code) ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`)}
                  >
                    Switch to Free
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`)}
                    color={alias === 'elite' ? 'secondary' : 'primary'}
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
