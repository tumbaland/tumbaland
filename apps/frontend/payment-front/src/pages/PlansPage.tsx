import React, { useEffect, useState } from 'react';
import { Box, Card, CardActions, CardContent, Button, Typography, Divider, Chip, Avatar } from '@mui/material';
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
        <Star sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          Choose Your Plan
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 600, mx: 'auto' }}>
          Pick the plan that matches your current stage. You can upgrade or downgrade anytime. Higher tiers unlock more capacity, privacy, monetization and performance.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
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
              sx={{
                position: 'relative',
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                border: isCurrentPlan ? '2px solid #667eea' : '1px solid #e9ecef',
                transform: isPopular ? 'scale(1.02)' : 'scale(1)',
                '&:hover': {
                  transform: isPopular ? 'scale(1.04)' : 'scale(1.02)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: '#667eea'
                }
              }}
            >
              {isPopular && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
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

              <Box
                sx={{
                  height: 80,
                  background: alias === 'free' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                             alias === 'pro' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                             'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                  {alias === 'free' ? <Star sx={{ color: 'white' }} /> :
                   alias === 'pro' ? <CheckCircle sx={{ color: 'white' }} /> :
                   <SmartToy sx={{ color: 'white' }} />}
                </Avatar>
              </Box>

              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {plan.name}
                </Typography>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
                  {plan.priceMonthlyCents ? `${(plan.priceMonthlyCents / 100).toFixed(2)} €/mo` : 'Free'}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {cardFeatureOrder.map(k => {
                    const icon = k === 'uploads' ? <CloudUpload sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} /> :
                               k === 'storage' ? <Storage sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} /> :
                               k === 'privacy' ? <CheckCircle sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} /> :
                               k === 'history' ? <History sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} /> :
                               k === 'ai' ? <SmartToy sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} /> :
                               <People sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />;

                    return (
                      <Box key={k} sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
                        {icon}
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          <strong>{matrixByKey[k].label}:</strong> {renderValue(k, alias)}
                        </Typography>
                      </Box>
                    );
                  })}

                  {alias === 'elite' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', mt: 1 }}>
                      <Star sx={{ fontSize: 16, mr: 1, color: '#ff6b6b' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff6b6b' }}>
                        Exclusive Award: TumbaBubu plush 🧸
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                {isCurrentPlan ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled
                    sx={{
                      borderColor: '#667eea',
                      color: '#667eea',
                      '&.Mui-disabled': {
                        borderColor: '#667eea',
                        color: '#667eea'
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
                    sx={{ borderRadius: 2 }}
                  >
                    Switch to Free
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/subscription/checkout?plan=${encodeURIComponent(plan.code)}`)}
                    sx={{
                      borderRadius: 2,
                      background: alias === 'free' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                                 alias === 'pro' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                                 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      '&:hover': {
                        background: alias === 'free' ? 'linear-gradient(135deg, #e84393 0%, #e17055 100%)' :
                                   alias === 'pro' ? 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' :
                                   'linear-gradient(135deg, #3d9dfd 0%, #00d4ff 100%)'
                      }
                    }}
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
