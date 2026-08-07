import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  UploadFile as UploadIcon,
  Download as DownloadIcon,
  AccountBalanceWallet as WalletIcon,
  Rule as RuleIcon
} from '@mui/icons-material';
import TableSortLabel from '@mui/material/TableSortLabel';
import { useTenantFilter } from '@tumbaland/components';
import {
  useTransactions,
  useTransactionCategories,
  useCashflowSummary,
  useAnalytics,
  useDeleteTransaction,
  useExportTransactions
} from '../hooks/useCashflow';
import { Transaction } from '../services/cashflowService';
import ImportDialog from '../components/cashflow/ImportDialog';
import CashflowAnalytics from '../components/cashflow/CashflowAnalytics';
import CategoryBreakdown from '../components/cashflow/CategoryBreakdown';
import CategoryEditDialog from '../components/cashflow/CategoryEditDialog';
import CategoryRulesDialog from '../components/cashflow/CategoryRulesDialog';
import CashflowSummaryCards from '../components/cashflow/CashflowSummaryCards';
import TransactionFilters, {
  FilterValues,
  EMPTY_FILTERS,
  toQuery
} from '../components/cashflow/TransactionFilters';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatCurrency } from '../utils/numberUtils';

const PAGE_SIZE = 100;

/**
 * The cash-flow layer: what came in and went out, where it is heading, and what
 * it explains about the net-worth line on the dashboard.
 *
 * Entries arrive by importing a bank statement rather than being typed — with
 * thousands of rows a year, hand entry was never going to keep up.
 */
const CashFlowPage: React.FC = () => {
  const tenantGroupId = useTenantFilter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const query = useMemo(
    () => ({
      groupId: tenantGroupId,
      ...toQuery(filters),
      sort,
      direction,
      limit: PAGE_SIZE,
      skip: page * PAGE_SIZE
    }),
    [tenantGroupId, filters, page, sort, direction]
  );

  const { data, isLoading, error } = useTransactions(query);
  const { data: categories = [] } = useTransactionCategories(tenantGroupId);
  const { data: summary } = useCashflowSummary(tenantGroupId);
  const { data: analytics } = useAnalytics(tenantGroupId);
  const deleteMutation = useDeleteTransaction();
  const exportMutation = useExportTransactions();

  const transactions = data?.items ?? [];
  const totals = data?.totals;

  // Any filter change invalidates the page you were on.
  const applyFilters = (next: FilterValues) => {
    setFilters(next);
    setPage(0);
  };

  /** Clicking the active column flips it; a new column starts newest/largest first. */
  const applySort = (field: 'date' | 'amount') => {
    if (field === sort) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(field); setDirection('desc'); }
    setPage(0);
  };

  const notify = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ message, severity });

  /**
   * Export exactly what the filter matches — filter to Uncategorised, export,
   * fill the category column in a spreadsheet, and import the file back.
   */
  const handleExport = async () => {
    try {
      const filename = await exportMutation.mutateAsync({ groupId: tenantGroupId, ...toQuery(filters) });
      notify(`Exported ${filename}`, 'success');
    } catch {
      notify('Failed to export', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      setSnackbar({ message: 'Transaction deleted', severity: 'success' });
    } catch {
      setSnackbar({ message: 'Failed to delete the transaction', severity: 'error' });
    }
    setDeleteTarget(null);
  };

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load transactions</Alert>
      </Box>
    );
  }

  const nothingAtAll = !totals || (totals.count === 0 && !filters.search && !filters.category);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Cash Flow</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            What you earn and spend — and how much of your net-worth change it explains
          </Typography>
        </Box>
        <Button startIcon={<RuleIcon />} onClick={() => setRulesOpen(true)}>
          Category rules
        </Button>
        <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>
          Import statement
        </Button>
      </Box>

      {nothingAtAll ? (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 6, textAlign: 'center' }}
        >
          <WalletIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
            No transactions yet
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Import a bank statement and the dashboard can tell you whether your net worth grew
            because you saved or because the market moved.
          </Typography>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setImportOpen(true)}>
            Import your first statement
          </Button>
        </Paper>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Overview" />
            <Tab label="Trends" />
            <Tab label="Categories" />
            <Tab label={`Transactions (${totals?.count.toLocaleString() ?? 0})`} />
          </Tabs>

          <Box role="tabpanel" hidden={tab !== 0}>
            {tab === 0 && summary && summary.months.length > 0 && (
              <CashflowSummaryCards summary={summary} analytics={analytics} />
            )}
          </Box>

          <Box role="tabpanel" hidden={tab !== 1}>
            {tab === 1 && analytics && <CashflowAnalytics analytics={analytics} />}
          </Box>

          <Box role="tabpanel" hidden={tab !== 2}>
            {tab === 2 && analytics && <CategoryBreakdown analytics={analytics} />}
          </Box>

          <Box role="tabpanel" hidden={tab !== 3}>
            {tab === 3 && (
              <>
                <TransactionFilters
                  filters={filters}
                  onChange={applyFilters}
                  categories={categories}
                  totals={totals}
                  years={(analytics?.years || []).map((y) => y.year)}
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleExport}
                    disabled={exportMutation.isPending || !totals?.count}
                  >
                    Export {totals?.count ? `these ${totals.count.toLocaleString()}` : ''} as CSV
                  </Button>
                </Box>

                {transactions.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, textAlign: 'center' }}
                  >
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                      Nothing matches these filters.
                    </Typography>
                  </Paper>
                ) : isMobile ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {transactions.map((transaction) => (
                      <Paper
                        key={transaction._id}
                        elevation={0}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>{transaction.category}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {transaction.date.slice(0, 10)}
                              {transaction.note ? ` · ${transaction.note.slice(0, 60)}` : ''}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexShrink: 0 }}>
                            <IconButton size="small" title="Change category" onClick={() => setEditTarget(transaction)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => setDeleteTarget(transaction)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            mt: 1,
                            color: transaction.type === 'income' ? 'success.main' : 'error.main'
                          }}
                        >
                          {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sortDirection={sort === 'date' ? direction : false}>
                            <TableSortLabel
                              active={sort === 'date'}
                              direction={sort === 'date' ? direction : 'desc'}
                              onClick={() => applySort('date')}
                            >
                              Date
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Note</TableCell>
                          <TableCell align="right" sortDirection={sort === 'amount' ? direction : false}>
                            <TableSortLabel
                              active={sort === 'amount'}
                              direction={sort === 'amount' ? direction : 'desc'}
                              onClick={() => applySort('amount')}
                            >
                              Amount
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right" sx={{ width: 96 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction._id} hover>
                            <TableCell>{transaction.date.slice(0, 10)}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={transaction.category}
                                color={transaction.type === 'income' ? 'success' : 'default'}
                                variant="outlined"
                                onClick={() => setEditTarget(transaction)}
                              />
                            </TableCell>
                            <TableCell
                              sx={{
                                color: 'text.secondary',
                                maxWidth: 420,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={transaction.note}
                            >
                              {transaction.note || '—'}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 600,
                                color: transaction.type === 'income' ? 'success.main' : 'error.main'
                              }}
                            >
                              {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                title="Change category"
                                onClick={() => setEditTarget(transaction)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => setDeleteTarget(transaction)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {(page > 0 || data?.hasMore) && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 2 }}>
                    <Button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      Previous
                    </Button>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + transactions.length} of{' '}
                      {totals?.count.toLocaleString()}
                    </Typography>
                    <Button disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        </>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} tenantGroupId={tenantGroupId} />

      {/* Mounted only while open: the dialog loads the rule list, and rendering
          it unconditionally would fetch that on every visit to this page for
          the sake of a button most visits never press. */}
      {rulesOpen && (
        <CategoryRulesDialog
          open
          onClose={() => setRulesOpen(false)}
          categories={categories}
          tenantGroupId={tenantGroupId}
          notify={notify}
        />
      )}

      <CategoryEditDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        transaction={editTarget}
        categories={categories}
        tenantGroupId={tenantGroupId}
        notify={notify}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete transaction"
        message={`Delete the ${deleteTarget ? formatCurrency(deleteTarget.amount) : ''} ${deleteTarget?.category} entry? Re-importing the statement would bring it back.`}
        confirmText="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity || 'success'} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CashFlowPage;
