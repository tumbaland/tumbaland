import React, { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { GrowthBreakdown } from '../../services/cashflowService';
import { formatCurrency, formatPeriod } from '../../utils/numberUtils';

interface NetWorthMovementProps {
  /** The trailing year of check-ins — the default, and the scope of the page. */
  trailing: GrowthBreakdown | null;
  /** The last pair of check-ins, for reading one month on its own. */
  monthly: GrowthBreakdown | null;
  currency?: string;
}

type Scope = 'trailing' | 'monthly';

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');
const signed = (v: number, format: (n: number) => string) => `${v > 0 ? '+' : ''}${format(v)}`;

/**
 * Why net worth moved: the part explained by money put aside, and the part left
 * to the market.
 *
 * Defaults to the trailing year because everything else on this page is on that
 * scope, and dropping from a twelve-month summary straight into a single-month
 * bridge made two figures that measure different things sit side by side. One
 * month of market movement is noise anyway; a year of it is a return.
 */
const NetWorthMovement: React.FC<NetWorthMovementProps> = ({
  trailing,
  monthly,
  currency = 'EUR'
}) => {
  const [scope, setScope] = useState<Scope>('trailing');
  const money = (v: number) => formatCurrency(v, currency);

  const growth = scope === 'monthly' ? (monthly ?? trailing) : (trailing ?? monthly);
  if (!growth) return null;

  // Only worth offering when the two cover different ground — with a short
  // history the "year" is the pair of check-ins, and a toggle between a view
  // and itself is furniture.
  const bothSpans =
    trailing && monthly && (trailing.from !== monthly.from || trailing.to !== monthly.to);

  const span = `${formatPeriod(growth.from)} → ${formatPeriod(growth.to)}`;
  const length = `${growth.months} month${growth.months === 1 ? '' : 's'}`;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Net worth movement
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Telling new capital apart from what the market did — the difference between saving
              well and investing well.
            </Typography>
          </Box>
          {bothSpans && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scope}
              onChange={(_, next: Scope | null) => next && setScope(next)}
            >
              <ToggleButton value="trailing">Last 12 months</ToggleButton>
              <ToggleButton value="monthly">Monthly bridge</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          {span} · {length}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2
          }}
        >
          {/* The change itself comes from the two check-ins alone, so it holds
              whether or not the transactions cover the span. Only the split
              below it depends on them. */}
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Net worth change
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: signColor(growth.netWorthChange) }}>
              {signed(growth.netWorthChange, money)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Between the two check-ins
            </Typography>
          </Box>

          {growth.complete && (
            <>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Capital contributed
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {signed(growth.contributions, money)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Money you put in or took out
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Market return
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: signColor(growth.marketGrowth) }}>
                  {signed(growth.marketGrowth, money)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  What the holdings did on their own
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {!growth.complete && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Splitting that between money saved and market movement needs transactions covering every
            month from {formatPeriod(growth.from)} to {formatPeriod(growth.to)}. Import the missing
            statements and the split will appear here.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NetWorthMovement;
