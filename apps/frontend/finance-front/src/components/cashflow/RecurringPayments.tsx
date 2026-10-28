import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { formatDay as sharedFormatDay } from '@tumbaland/frontend-core';
import { Cadence, RecurringPayment, RecurringReport } from '../../services/cashflowService';
import { formatPrice } from '../../utils/numberUtils';

interface RecurringPaymentsProps {
  report: RecurringReport;
  currency?: string;
}

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly'
};

/**
 * Above this the charge is a variable bill — an energy account, a phone plan
 * that bills for usage — not a fixed subscription. Worth saying, because the
 * monthly figure beside it is a median rather than a price.
 */
const VARIABLE_THRESHOLD = 0.15;

const formatDay = (day: string): string => sharedFormatDay(day, { month: 'short', day: 'numeric' });

const dueLabel = (payment: RecurringPayment): string => {
  if (payment.status === 'lapsed') return `stopped after ${formatDay(payment.lastCharge)}`;
  const { daysUntilNext } = payment;
  if (daysUntilNext < 0) return `overdue since ${formatDay(payment.nextExpected)}`;
  if (daysUntilNext === 0) return 'due today';
  if (daysUntilNext === 1) return 'due tomorrow';
  return `due ${formatDay(payment.nextExpected)}`;
};

/**
 * How confident the detection is, in words. The share of gaps that fit the
 * cadence is the honest measure — a charge that has skipped a month is still
 * worth listing, but should not be presented as if it were metronomic.
 */
const confidenceLabel = (payment: RecurringPayment): string =>
  `${payment.occurrences} charges since ${formatDay(payment.firstCharge)}, ${Math.round(
    payment.regularity * 100
  )}% on cycle`;

/**
 * The subscriptions hiding in the statement, and what they cost.
 *
 * Nothing here was declared by the owner: it is inferred from repeated charges
 * to the same merchant, which is the only way it works when entries arrive by
 * the thousand from a bank export. The list is deliberately short — a page
 * padded with the weekly supermarket run is one nobody reads.
 */
const RecurringPayments: React.FC<RecurringPaymentsProps> = ({ report, currency = 'EUR' }) => {
  // formatPrice rather than formatCurrency: this page's other figures are
  // yearly category totals where cents are noise, but here they are the
  // difference between one subscription and another — rounded to whole euros,
  // a 4.99 and a 5.49 charge print identically, and a price rise from 9.99 to
  // 10.49 renders as "10 € → 10 €".
  const money = (value: number) => formatPrice(value, currency);

  if (report.payments.length === 0) {
    return (
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Recurring payments
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nothing yet — a charge has to repeat on a regular cycle at least three times before it
            can be told apart from ordinary spending.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recurring payments
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {money(report.monthlyTotal)} a month · {money(report.yearlyTotal)} a year, across{' '}
            {report.payments.length - report.lapsedCount} still running
            {report.lapsedCount > 0 && ` (${report.lapsedCount} stopped)`}
          </Typography>
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Merchant</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell align="right">Charge</TableCell>
                <TableCell align="right">Per month</TableCell>
                <TableCell align="right">Per year</TableCell>
                <TableCell>Next</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.payments.map((payment) => (
                <TableRow
                  key={payment.key}
                  // A stopped subscription stays in the list — knowing it ended
                  // is worth as much as knowing it runs — but reads as past.
                  sx={{ opacity: payment.status === 'lapsed' ? 0.55 : 1 }}
                >
                  <TableCell>
                    <Tooltip title={confidenceLabel(payment)}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {payment.merchant}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {payment.category}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{CADENCE_LABELS[payment.cadence]}</Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2">{money(payment.amount)}</Typography>
                    {payment.amountVariation > VARIABLE_THRESHOLD && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        varies
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">{money(payment.monthlyEquivalent)}</TableCell>
                  <TableCell align="right">{money(payment.yearlyEquivalent)}</TableCell>

                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          payment.status === 'due'
                            ? 'warning.main'
                            : payment.status === 'lapsed'
                              ? 'text.secondary'
                              : 'text.primary'
                      }}
                    >
                      {dueLabel(payment)}
                    </Typography>
                    {payment.priceChange && (
                      <Tooltip
                        title={`Was ${money(payment.priceChange.previousAmount)}, changed on ${formatDay(
                          payment.priceChange.changedOn
                        )}`}
                      >
                        <Chip
                          size="small"
                          icon={<TrendingUpIcon />}
                          color={
                            payment.priceChange.currentAmount > payment.priceChange.previousAmount
                              ? 'warning'
                              : 'success'
                          }
                          label={`${money(payment.priceChange.previousAmount)} → ${money(
                            payment.priceChange.currentAmount
                          )}`}
                          sx={{ mt: 0.5 }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecurringPayments;
