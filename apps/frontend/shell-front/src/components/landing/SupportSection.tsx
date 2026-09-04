import { useState } from 'react';
import { brand, ink } from '../../theme/tokens';
import { Alert, Box, Button, Chip, Paper, Skeleton, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteIcon from '@mui/icons-material/Favorite';
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

interface SupportSectionProps extends PlansState {
  onChoosePlan: (code: string) => void;
}

/**
 * The money section, and the whole page's answer to "what does this cost".
 *
 * It used to be a three-column pricing table with the middle card highlighted
 * and a "Most people" badge on it — the standard SaaS shape, which tells a
 * visitor the free column is the crippled one and the real product starts at
 * €6. That is not what this is.
 *
 * The copy rule for everything below: **the site is free, and support is
 * welcome.** Not "free tier versus paid tier", not "paid only if you want to
 * chip in" — both quietly restate that there is a transaction on offer and the
 * free version is the lesser half of it. Support is something someone may
 * choose to do for a project they like; it is never the price of anything.
 *
 * So: the free card is highlighted, the support card's button names the
 * gesture rather than a purchase, and the section sits *after* the FAQ rather
 * than in the middle of the page. The numbers are unchanged and still come from
 * `GET /api/plans` — softening the ask is not a licence to soften what a plan
 * actually grants.
 */
export function SupportSection({ onChoosePlan, plans, loading, failed }: SupportSectionProps) {
  const [interval, setInterval] = useState<BillingInterval>('month');

  const handleInterval = (_e: React.MouseEvent<HTMLElement>, next: BillingInterval | null) => {
    if (next) setInterval(next);
  };

  // Any paid plan will do — there is one, `support`, and looking it up by
  // price rather than by code keeps the toggle working if an admin adds another.
  const paidPlan = plans.find((p) => p.priceMonthlyCents > 0);
  const savedMonths = paidPlan ? yearlySavingMonths(paidPlan) : 0;
  const showIntervalToggle = hasYearlyPricing(plans);

  return (
    <Box component="section" id="support" sx={{ py: { xs: 6, md: 8 }, px: 2, scrollMarginTop: 24 }}>
      <SectionHeading
        eyebrow="Support"
        title="The site is free. Support is welcome."
        subtitle="Everything works without paying, and it stays that way. If you want to chip in towards running costs, you can. Supporters get a lot more room."
      />

      {PRICING_STATUS === 'preview' && (
        <Alert
          icon={<FavoriteIcon fontSize="inherit" />}
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
          <strong>Supporting isn&apos;t open yet.</strong> The figures below are published early so
          you can see them. Nothing is charged either way.
        </Alert>
      )}

      {/*
        A failure is said out loud rather than papered over with a hardcoded
        table. The numbers on these cards are the numbers the services enforce;
        the moment the page can invent them, they are two different claims
        again — which is the defect this section was rebuilt to remove.
      */}
      {failed && (
        <Alert
          severity="info"
          sx={{ maxWidth: 620, mx: 'auto', mb: 4, borderRadius: 3, justifyContent: 'center' }}
        >
          Plan details are temporarily unavailable. Everything else keeps working.
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
                color: ink.body
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
          // auto-fit rather than a fixed column count: there are two plans
          // today, and the catalog is admin-editable at runtime.
          gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(300px, 1fr))' },
          gap: 2.5,
          maxWidth: 820,
          mx: 'auto',
          // Stretch, not `start`: the two cards carry a different number of
          // limit lines (free has no planner row), and letting each take its
          // natural height leaves them visibly mismatched side by side.
          alignItems: 'stretch'
        }}
      >
        {loading &&
          [0, 1].map((i) => (
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
          const paid = plan.priceMonthlyCents > 0;
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
              {/* The badge on the free card, not on the dearest one a visitor
                  might otherwise read as the "real" product. */}
              {highlight && (
                <Chip
                  label="Where everyone starts"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontWeight: 600,
                    fontSize: 11,
                    backgroundColor: brand.magenta,
                    color: '#fff'
                  }}
                />
              )}

              <Typography
                component="h3"
                sx={{ fontSize: '1.15rem', fontWeight: 700, color: ink.strong }}
              >
                {plan.name}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Typography
                  sx={{
                    fontSize: '2.4rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: ink.strong,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {formatPrice(cents)}
                </Typography>
                {cents > 0 && (
                  <Typography sx={{ color: ink.muted, fontSize: '0.95rem' }}>
                    / {interval === 'month' ? 'month' : 'year'}
                  </Typography>
                )}
              </Box>

              <Typography sx={{ color: ink.body, fontSize: '0.93rem', lineHeight: 1.55, minHeight: 44 }}>
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
                    ? { backgroundColor: brand.magenta, '&:hover': { backgroundColor: '#a21caf' } }
                    : { borderColor: 'rgba(147,51,234,0.35)', color: brand.purple })
                }}
              >
                {paid ? 'Become a supporter' : 'Start free'}
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
          color: ink.muted,
          fontSize: '0.88rem',
          mt: 3,
          maxWidth: 640,
          mx: 'auto',
          lineHeight: 1.6
        }}
      >
        No upsell after this, and nothing changes for anyone who never supports. Support covers the
        three bills the limits come from: photo storage, GPU time, and the market data key. Amounts
        include VAT where applicable.
      </Typography>
    </Box>
  );
}

export default SupportSection;
