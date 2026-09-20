import { useCallback } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { brand, ink, UsageMeter, useEntitlements } from '@tumbaland/frontend-core';
import { canOfferPurchases } from '../../services/platform';
import { isUnlimited } from '@tumbaland/frontend-core';
import { getMyEntitlements } from '../../services/entitlementsService';

/**
 * What the account is allowed, and how much of it is used.
 *
 * This is the one place a *free* user sees their own ceilings. Until it
 * existed, the meters lived only next to the things they gate — the album
 * dashboard, the upload dialog, the ticker list — so a limit was only ever
 * visible to someone already deep inside the module it applies to, and the
 * first news of a ceiling was usually the refusal at it.
 *
 * **Only enforced limits appear here.** `aiJobs` counts nothing since AI photo
 * analysis was removed, and `seats` is metered but nothing refuses on it (the
 * seats chokepoint is unwired). `seats` in particular would paint an existing
 * group owner's bar red for a rule no service applies. That is the same line the pricing
 * table draws: a number shown to a user is a claim the product is held to.
 */

/** `free` → `Free`. The catalog's display names are one more fetch than this card is worth. */
function planLabel(planCode: string): string {
  return planCode.charAt(0).toUpperCase() + planCode.slice(1);
}

function retentionLine(retentionDays: number): string {
  return isUnlimited(retentionDays)
    ? 'Full history, as far back as it goes'
    : `History is kept for ${retentionDays} days`;
}

export function PlanUsageCard() {
  const navigate = useNavigate();
  const { entitlements, loading, error } = useEntitlements(getMyEntitlements);

  const handleSeePlans = useCallback(() => navigate('/payments'), [navigate]);
  // Plans are for the website. In an app store build there is no plans page to
  // send anyone to (see canOfferPurchases), so the card only reports usage.
  const offerPlans = canOfferPurchases();

  // A failed lookup is not an error state: the home page works without this
  // card, and a red box where a usage bar should be is worse than no bar.
  if (loading || error || !entitlements) return null;

  const { limits, usage, planCode, isComp } = entitlements;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.75, md: 2.25 },
        borderRadius: 3.5,
        background: 'rgba(255,255,255,0.62)',
        border: '1px solid rgba(255,255,255,0.7)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: brand.magenta
          }}
        >
          Your plan
        </Typography>
        <Chip
          label={isComp ? `${planLabel(planCode)} · complimentary` : planLabel(planCode)}
          size="small"
          sx={{
            height: 20,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: 'rgba(192,38,211,0.12)',
            color: '#a21caf'
          }}
        />
        <Box sx={{ flex: 1 }} />
        {offerPlans && (
          <Button
            size="small"
            onClick={handleSeePlans}
            sx={{ textTransform: 'none', fontWeight: 600, color: brand.purple, mr: '-6px' }}
          >
            See plans
          </Button>
        )}
      </Box>

      <UsageMeter
        label="Photo storage"
        used={usage.storageBytes}
        limit={limits.meters.storageBytes}
        unit="bytes"
        onUpgrade={offerPlans ? handleSeePlans : undefined}
        upgradeLabel="See plans"
      />
      <UsageMeter
        label="Tracked tickers"
        used={usage.trackedTickers}
        limit={limits.meters.trackedTickers}
        onUpgrade={offerPlans ? handleSeePlans : undefined}
        upgradeLabel="See plans"
      />

      <Typography sx={{ fontSize: 13, color: ink.muted, mt: 0.5 }}>
        {retentionLine(limits.retentionDays)}
      </Typography>
    </Box>
  );
}

export default PlanUsageCard;
