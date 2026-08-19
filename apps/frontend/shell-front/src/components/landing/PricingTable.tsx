import { useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CelebrationIcon from '@mui/icons-material/Celebration';
import {
  BillingInterval,
  CatalogPlan,
  PRICING_STATUS,
  formatPrice,
  hasYearlyPricing,
  isHighlighted,
  limitLinesFor,
  priceFor,
  taglineFor,
  yearlySavingMonths
} from '../../config/pricing';
import { PlansState } from '../../hooks/usePlans';
import { SectionHeading } from './SectionHeading';

interface PricingTableProps extends PlansState {
  onChoosePlan: (code: string) => void;
}

export function PricingTable({ onChoosePlan, plans, loading, failed }: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>('month');

  const handleInterval = (_e: React.MouseEvent<HTMLElement>, next: BillingInterval | null) => {
    if (next) setInterval(next);
  };

  const personal = plans.find((p) => p.code === 'personal') ?? plans.find((p) => p.priceMonthlyCents > 0);
  const savedMonths = personal ? yearlySavingMonths(personal) : 0;
  const showIntervalToggle = hasYearlyPricing(plans);

  return (
    <Box component="section" id="pricing" sx={{ py: { xs: 6, md: 8 }, px: 2, scrollMarginTop: 24 }}>
      <SectionHeading
        eyebrow="Pricing"
        title="Real numbers, published early"
        subtitle="One subscription covers the whole household."
      />

      {PRICING_STATUS === 'preview' && (
        <Alert
          icon={<CelebrationIcon fontSize="inherit" />}
          sx={{
            maxWidth: 620,
            mx: 'auto',
            mb: 4,
            borderRadius: 3,
            justifyContent: 'center',
            backgroundColor: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.28)',
            color: '#166534',
            '& .MuiAlert-icon': { color: '#16a34a' }
          }}
        >
          <strong>Everything is free right now.</strong> Paid tiers are coming later.
        </Alert>
      )}

      {/*
        A failure is said out loud rather than papered over with a hardcoded
        table. The numbers on these cards are the numbers the services enforce;
        the moment the page can invent them, they are two different things
        again — which is the defect this section was rebuilt to remove.
      */}
      {failed && (
        <Alert
          severity="info"
          sx={{ maxWidth: 620, mx: 'auto', mb: 4, borderRadius: 3, justifyContent: 'center' }}
        >
          Pricing is temporarily unavailable. Everything on the free tier keeps working.
        </Alert>
      )}

      {showIntervalToggle && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <ToggleButtonGroup
            value={interval}
            exclusive
            onChange={handleInterval}
            aria-label="Billing interval"
            sx={{
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderRadius: 3,
              p: 0.5,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '10px !important',
                textTransform: 'none',
                fontWeight: 600,
                px: 2.5,
                py: 0.75,
                color: '#475569'
              },
              '& .Mui-selected': {
                backgroundColor: '#c026d3 !important',
                color: '#fff !important'
              }
            }}
          >
            <ToggleButton value="month" aria-label="Monthly">
              Monthly
            </ToggleButton>
            <ToggleButton value="year" aria-label="Yearly">
              Yearly
              {savedMonths > 0 && (
                <Chip
                  label={`${savedMonths} months free`}
                  size="small"
                  sx={{
                    ml: 1,
                    height: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: 'rgba(34,197,94,0.16)',
                    color: '#15803d'
                  }}
                />
              )}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2.5,
          maxWidth: 1080,
          mx: 'auto',
          alignItems: 'start'
        }}
      >
        {loading &&
          [0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={360}
              aria-label="Loading plans"
              sx={{ borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }}
            />
          ))}

        {plans.map((plan: CatalogPlan) => {
          const cents = priceFor(plan, interval);
          const highlight = isHighlighted(plan);
          return (
            <Paper
              key={plan.code}
              elevation={0}
              sx={{
                p: { xs: 3, md: 3.5 },
                borderRadius: 4,
                background: highlight
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,235,250,0.7))'
                  : 'rgba(255,255,255,0.62)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: highlight ? '2px solid #c026d3' : '1px solid rgba(255,255,255,0.7)',
                boxShadow: highlight
                  ? '0 18px 40px -24px rgba(192,38,211,0.7)'
                  : '0 10px 30px -22px rgba(31,38,135,0.5)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}
            >
              {highlight && (
                <Chip
                  label="Most people"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontWeight: 600,
                    fontSize: 11,
                    backgroundColor: '#c026d3',
                    color: '#fff'
                  }}
                />
              )}

              <Typography
                component="h3"
                sx={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}
              >
                {plan.name}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Typography
                  sx={{
                    fontSize: '2.4rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {formatPrice(cents)}
                </Typography>
                {cents > 0 && (
                  <Typography sx={{ color: '#64748b', fontSize: '0.95rem' }}>
                    / {interval === 'month' ? 'month' : 'year'}
                  </Typography>
                )}
              </Box>

              <Typography sx={{ color: '#475569', fontSize: '0.93rem', lineHeight: 1.55, minHeight: 44 }}>
                {taglineFor(plan)}
              </Typography>

              <Button
                fullWidth
                variant={highlight ? 'contained' : 'outlined'}
                onClick={() => onChoosePlan(plan.code)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2.5,
                  py: 1.1,
                  mt: 0.5,
                  ...(highlight
                    ? { backgroundColor: '#c026d3', '&:hover': { backgroundColor: '#a21caf' } }
                    : { borderColor: 'rgba(147,51,234,0.35)', color: '#9333ea' })
                }}
              >
                {plan.priceMonthlyCents === 0 ? 'Start free' : `Choose ${plan.name}`}
              </Button>

              {/* Only what the tier includes, and only limits something
                  enforces. A row of dashes reads as a list of things the free
                  plan cannot do, which undersells it. */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                {limitLinesFor(plan.effectiveLimits).map((line) => (
                  <Box key={line.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <CheckIcon sx={{ fontSize: 17, mt: '2px', color: '#22c55e', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                      {line.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Typography
        sx={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.88rem',
          mt: 3,
          maxWidth: 640,
          mx: 'auto',
          lineHeight: 1.6
        }}
      >
        Prices include VAT where applicable. Yearly plans bill once and cancel at the end of the
        paid year.
      </Typography>
    </Box>
  );
}

export default PricingTable;
