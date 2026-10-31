import React from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import { ArrowForward, ShowChart } from '@mui/icons-material';
import { Link } from 'react-router';
import { DashboardData } from '../services/dashboardService';
import { formatCurrency, formatPct, formatPrice } from '../utils/numberUtils';
import { appPath } from '../appBase';

interface InvestmentsSummaryCardProps {
  holdings: NonNullable<DashboardData['holdings']>;
  currency?: string;
}

const signColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.primary');
const labelSx = { color: 'text.secondary', fontSize: { xs: '0.75rem', md: '0.875rem' } };
const figureSx = { fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.25rem' }, lineHeight: 1.3 };

/**
 * What investing has made, in all the ways it makes money.
 *
 * Price movement is only one: dividends are income and sales crystallise gains,
 * and both outlive the position that earned them, so the totals here count the
 * positions since sold as well as the ones still held.
 */
const InvestmentsSummaryCard: React.FC<InvestmentsSummaryCardProps> = ({ holdings, currency = 'EUR' }) => {
  // Optional on the payload so an older service does not break the card.
  const dividends = holdings.dividends ?? 0;
  const realized = holdings.realizedGain ?? 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: { xs: 1.5, md: 4 }, '&:last-child': { pb: { xs: 1.5, md: 4 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2.5 } }}>
          <ShowChart sx={{ mr: { xs: 1, md: 2 }, color: '#667eea', fontSize: { xs: 20, md: 24 } }} />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
            Investments · {holdings.count} holding{holdings.count === 1 ? '' : 's'}
          </Typography>
          <Button
            component={Link}
            to={appPath('/investments')}
            size="small"
            aria-label="View holdings"
            endIcon={<ArrowForward />}
            sx={{ whiteSpace: 'nowrap', minWidth: 0, '& .MuiButton-endIcon': { ml: { xs: 0, md: 1 } } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              View holdings
            </Box>
          </Button>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 2 }
          }}
        >
          <Box>
            <Typography variant="body2" sx={labelSx}>Market value</Typography>
            <Typography variant="h6" sx={figureSx}>{formatCurrency(holdings.totalValue, currency)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Unrealized P/L</Typography>
            <Typography variant="h6" sx={{ ...figureSx, color: signColor(holdings.gain) }}>
              {holdings.gain >= 0 ? '+' : ''}{formatCurrency(holdings.gain, currency)}{' '}
              <Box component="span" sx={{ fontSize: '0.8em', whiteSpace: 'nowrap' }}>
                ({formatPct(holdings.gainPct)})
              </Box>
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Dividends received</Typography>
            <Typography variant="h6" sx={{ ...figureSx, color: dividends > 0 ? 'success.main' : 'text.primary' }}>
              {dividends > 0 ? formatPrice(dividends, currency) : '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>all time, incl. sold funds</Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={labelSx}>Realized gains</Typography>
            <Typography variant="h6" sx={{ ...figureSx, color: signColor(realized) }}>
              {realized === 0 ? '—' : `${realized > 0 ? '+' : ''}${formatCurrency(realized, currency)}`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>from selling, all time</Typography>
          </Box>
        </Box>

        {holdings.unconverted > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {holdings.unconverted} holding{holdings.unconverted === 1 ? ' is' : 's are'} quoted in a currency with no
            exchange rate yet, so they are not included in these totals.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default InvestmentsSummaryCard;
