import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShowChart as ShowChartIcon,
  ReceiptLong as ReceiptLongIcon
} from '@mui/icons-material';
import { Holding } from '../../services/holdingService';
import { useCreateHolding, useUpdateHolding, useDeleteHolding } from '../../hooks/useHoldings';
import TickerHistoryModal from '../TickerHistoryModal';
import TradeHistoryDialog from './TradeHistoryDialog';
import HoldingFormDialog, { HoldingForm, emptyHoldingForm } from './HoldingFormDialog';
import { parseNumericInput, formatCurrency, formatPrice, formatPct } from '../../utils/numberUtils';
import { ConfirmationModal, paywallMessage } from '@tumbaland/frontend-core';

interface HoldingsTabProps {
  holdings: Holding[];
  tenantGroupId?: string;
  notify: (message: string, severity: 'success' | 'error') => void;
}

const plColor = (v?: number) => (v === undefined ? 'text.secondary' : v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.secondary');

const HoldingsTab: React.FC<HoldingsTabProps> = ({ holdings, tenantGroupId, notify }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const createMutation = useCreateHolding();
  const updateMutation = useUpdateHolding();
  const deleteMutation = useDeleteHolding();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HoldingForm>(emptyHoldingForm);
  const [deleteTarget, setDeleteTarget] = useState<Holding | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const [tradesFor, setTradesFor] = useState<Holding | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyHoldingForm);
    setDialogOpen(true);
  };

  const openEdit = (h: Holding) => {
    setEditingId(h._id!);
    setForm({
      ticker: h.ticker,
      displayName: h.displayName || '',
      currency: h.currency || '',
      quantity: String(h.quantity),
      avgBuyPrice: String(h.avgBuyPrice),
      buyDate: h.buyDate ? h.buyDate.slice(0, 10) : '',
      notes: h.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const quantity = parseNumericInput(form.quantity);
    const avgBuyPrice = parseNumericInput(form.avgBuyPrice);
    if (!form.ticker.trim() || isNaN(quantity) || isNaN(avgBuyPrice)) {
      notify('Ticker, quantity and average buy price are required', 'error');
      return;
    }
    try {
      const buyDate = form.buyDate || undefined;
      const notes = form.notes.trim() || undefined;
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          data: { ticker: form.ticker.trim(), quantity, avgBuyPrice, buyDate, notes }
        });
        notify('Holding updated', 'success');
      } else {
        await createMutation.mutateAsync({
          ticker: form.ticker.trim(),
          displayName: form.displayName.trim() || undefined,
          currency: form.currency || undefined,
          quantity,
          avgBuyPrice,
          buyDate,
          notes,
          groupId: tenantGroupId
        });
        notify('Holding added — its ticker is now tracked for daily prices', 'success');
      }
      setDialogOpen(false);
    } catch (err) {
      // Adding a holding starts tracking its ticker, so it can be refused by
      // the tracked-ticker limit — which must read as a price, not a failure.
      notify(paywallMessage(err, 'Failed to save holding'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id!);
      notify('Holding deleted', 'success');
    } catch {
      notify('Failed to delete holding', 'error');
    }
    setDeleteTarget(null);
  };

  // Every total is in the base currency, using the amounts the backend already
  // converted. A holding with no FX rate is left out entirely rather than
  // having its foreign-currency amount added in as if it were base currency.
  const baseCurrency = holdings.find((h) => h.baseCurrency)?.baseCurrency || 'EUR';
  const unconverted = holdings.filter((h) => h.missingFxRate);
  const totals = holdings
    .filter((h) => !h.missingFxRate)
    .reduce(
      (acc, h) => {
        acc.cost += h.costBasis ?? 0;
        if (h.currentValue !== undefined) acc.value += h.currentValue;
        if (h.valueIncrease !== undefined) acc.pl += h.valueIncrease;
        acc.realized += h.realizedGain ?? 0;
        return acc;
      },
      { cost: 0, value: 0, pl: 0, realized: 0 }
    );

  /** Per-share amounts stay in the instrument's own currency. */
  const nativePrice = (h: Holding, value?: number) =>
    value === undefined ? 'no data' : formatPrice(value, h.currency || baseCurrency);
  /** Totals are base currency, or a dash when they could not be converted. */
  const baseAmount = (value?: number) =>
    value === undefined ? '—' : formatCurrency(value, baseCurrency);

  const rowActions = (h: Holding) => (
    <>
      <IconButton size="small" onClick={() => setTradesFor(h)} title="Trade history">
        <ReceiptLongIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => setHistoryTicker(h.ticker)} title="Price history">
        <ShowChartIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => openEdit(h)}>
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => setDeleteTarget(h)}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add holding
        </Button>
      </Box>

      {unconverted.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No exchange rate yet for {[...new Set(unconverted.map((h) => h.currency))].join(', ')} →{' '}
          {baseCurrency}. {unconverted.length} holding{unconverted.length === 1 ? '' : 's'} shown without a
          converted value and left out of the totals; rates are fetched with the nightly price update.
        </Alert>
      )}

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {holdings.map((h) => (
            <Paper key={h._id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{h.ticker}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{h.displayName || '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0 }}>
                  {rowActions(h)}
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Quantity</Typography>
                  <Typography variant="body2">{h.quantity}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Avg buy</Typography>
                  <Typography variant="body2">{nativePrice(h, h.avgBuyPrice)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Cost</Typography>
                  <Typography variant="body2">{baseAmount(h.costBasis)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Latest price</Typography>
                  <Typography variant="body2">{nativePrice(h, h.latestPrice)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Value</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {baseAmount(h.currentValue)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: plColor(h.valueIncrease) }}>
                    {h.valueIncrease !== undefined ? `${h.valueIncrease >= 0 ? '+' : ''}${baseAmount(h.valueIncrease)}` : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: plColor(h.percentIncrease) }}>
                    {h.percentIncrease !== undefined ? formatPct(h.percentIncrease) : '—'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
          {holdings.length === 0 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No holdings yet — add your first ETF or stock position.
              </Typography>
            </Paper>
          )}
          {holdings.length > 0 && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total cost</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{formatCurrency(totals.cost, baseCurrency)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total value</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{formatCurrency(totals.value, baseCurrency)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: plColor(totals.pl) }}>
                    {`${totals.pl >= 0 ? '+' : ''}${formatCurrency(totals.pl, baseCurrency)}`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: plColor(totals.pl) }}>
                    {totals.cost > 0 ? formatPct((totals.pl / totals.cost) * 100) : '—'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ticker</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Avg buy</TableCell>
                <TableCell align="right">Cost ({baseCurrency})</TableCell>
                <TableCell align="right">Latest price</TableCell>
                <TableCell align="right">Value ({baseCurrency})</TableCell>
                <TableCell align="right">P/L ({baseCurrency})</TableCell>
                <TableCell align="right">P/L %</TableCell>
                <TableCell align="right">Realized</TableCell>
                <TableCell align="right" sx={{ width: 165 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holdings.map((h) => (
                <TableRow key={h._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{h.ticker}</TableCell>
                  <TableCell>
                    {h.notes ? (
                      <Tooltip title={h.notes}>
                        <span style={{ borderBottom: '1px dotted currentColor' }}>{h.displayName || '—'}</span>
                      </Tooltip>
                    ) : (h.displayName || '—')}
                  </TableCell>
                  <TableCell align="right">{h.quantity}</TableCell>
                  <TableCell align="right">{nativePrice(h, h.avgBuyPrice)}</TableCell>
                  <TableCell align="right">{baseAmount(h.costBasis)}</TableCell>
                  <TableCell align="right">
                    {h.latestPrice !== undefined ? (
                      <Tooltip title={h.latestPriceDate ? `As of ${h.latestPriceDate.slice(0, 10)}` : ''}>
                        <span>{nativePrice(h, h.latestPrice)}</span>
                      </Tooltip>
                    ) : 'no data'}
                  </TableCell>
                  <TableCell align="right">
                    {h.missingFxRate ? (
                      <Tooltip title={`No ${h.currency}→${baseCurrency} exchange rate yet`}>
                        <span>—</span>
                      </Tooltip>
                    ) : baseAmount(h.currentValue)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: plColor(h.valueIncrease) }}>
                    {h.valueIncrease !== undefined ? `${h.valueIncrease >= 0 ? '+' : ''}${baseAmount(h.valueIncrease)}` : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: plColor(h.percentIncrease) }}>
                    {h.percentIncrease !== undefined ? formatPct(h.percentIncrease) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: plColor(h.realizedGain) }}>
                    {h.tradeCount ? (
                      <Tooltip
                        title={`${h.tradeCount} trade${h.tradeCount === 1 ? '' : 's'}${h.dividends ? ` · ${formatCurrency(h.dividends, baseCurrency)} dividends` : ''}`}
                      >
                        <span>
                          {(h.realizedGain ?? 0) >= 0 ? '+' : ''}{formatCurrency(h.realizedGain ?? 0, baseCurrency)}
                        </span>
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {rowActions(h)}
                  </TableCell>
                </TableRow>
              ))}
              {holdings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      No holdings yet — add your first ETF or stock position.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {holdings.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(totals.cost, baseCurrency)}</TableCell>
                  <TableCell />
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(totals.value, baseCurrency)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: plColor(totals.pl) }}>
                    {`${totals.pl >= 0 ? '+' : ''}${formatCurrency(totals.pl, baseCurrency)}`}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: plColor(totals.pl) }}>
                    {totals.cost > 0 ? formatPct((totals.pl / totals.cost) * 100) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: plColor(totals.realized) }}>
                    {totals.realized ? `${totals.realized >= 0 ? '+' : ''}${formatCurrency(totals.realized, baseCurrency)}` : '—'}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      )}

      <HoldingFormDialog
        open={dialogOpen}
        editing={!!editingId}
        form={form}
        setForm={setForm}
        submitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete holding"
        message={`Delete ${deleteTarget?.ticker}? This cannot be undone.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historyTicker && (
        <TickerHistoryModal open={!!historyTicker} onClose={() => setHistoryTicker(null)} ticker={historyTicker} />
      )}

      {tradesFor && (
        <TradeHistoryDialog
          open={!!tradesFor}
          onClose={() => setTradesFor(null)}
          ticker={tradesFor.ticker}
          currency={tradesFor.currency}
          tenantGroupId={tenantGroupId}
          notify={notify}
        />
      )}
    </Box>
  );
};

export default HoldingsTab;
