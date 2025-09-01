import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TableSortLabel
} from '@mui/material';
import { Add, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTenantFilter } from '../components/tenant';
import {
  getFinanceRecords,
  createFinanceRecord,
  deleteFinanceRecord,
  updateFinanceRecord
} from '../services/financeRecordService';
import FinanceRecordModal from '../components/FinanceRecordModal';

const FinancialRecords: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const tenantGroupId = useTenantFilter(); // Get groupId from tenant context
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    date: '',
    secondPillar: '',
    secondPillarGain: '',
    thirdPillar: '',
    thirdPillarGain: '',
    etfPortfolio: '',
    etfGain: '',
    cash: '',
    gold: '',
    groupId: undefined as string | undefined
  });
  const [editForm, setEditForm] = useState({
    date: '',
    secondPillar: '',
    secondPillarGain: '',
    thirdPillar: '',
    thirdPillarGain: '',
    etfPortfolio: '',
    etfGain: '',
    cash: '',
    gold: ''
  });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Date filtering state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickRange, setQuickRange] = useState<string>(''); // e.g. '1M', '6M', '1Y'
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [tenantGroupId]); // Re-fetch when tenant context changes

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await getFinanceRecords({ groupId: tenantGroupId });
      setRecords(data);
      // Initialize date filters if unset
      if (data && data.length) {
        const dates = data.map((r: any) => new Date(r.date)).filter((d: Date) => !isNaN(d.getTime()));
        if (dates.length) {
          const max = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
          const min = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
          const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          if (!endDate) setEndDate(iso(max));
          if (!startDate) {
            // default to last 6 months but not before earliest
            const sixMonthsAgo = new Date(max);
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const start = sixMonthsAgo < min ? min : sixMonthsAgo;
            setStartDate(iso(start));
            setQuickRange('6M');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date for table display (DD.MM.YYYY)
  function formatDate(date: string | Date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Inline helper for local YYYY-MM-DD
  function toLocalInputDate(date: string | Date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  }

  const handleCreateOpen = () => {
    setCreateForm({
      date: toLocalInputDate(new Date()),
      secondPillar: '',
      secondPillarGain: '',
      thirdPillar: '',
      thirdPillarGain: '',
      etfPortfolio: '',
      etfGain: '',
      cash: '',
      gold: '',
      groupId: undefined
    });
    setCreateOpen(true);
  };
  const handleCreateClose = () => setCreateOpen(false);
  const handleEditOpen = (record: any) => {
    setEditId(record._id || record.id);
    setEditForm({
      date: toLocalInputDate(record.date),
      secondPillar: record.secondPillar?.toString() || '',
      secondPillarGain: record.secondPillarGain?.toString() || '',
      thirdPillar: record.thirdPillar?.toString() || '',
      thirdPillarGain: record.thirdPillarGain?.toString() || '',
      etfPortfolio: record.etfPortfolio?.toString() || '',
      etfGain: record.etfGain?.toString() || '',
      cash: record.cash?.toString() || '',
      gold: record.gold?.toString() || ''
    });
    setEditOpen(true);
  };
  const handleEditClose = () => setEditOpen(false);

  const handleCreateSubmit = async (form: any) => {
    const payload = {
      ...form,
      secondPillar: Number(form.secondPillar),
      secondPillarGain: Number(form.secondPillarGain),
      thirdPillar: Number(form.thirdPillar),
      thirdPillarGain: Number(form.thirdPillarGain),
      etfPortfolio: Number(form.etfPortfolio),
      etfGain: Number(form.etfGain),
      cash: Number(form.cash),
      gold: Number(form.gold),
      groupId: tenantGroupId // Use tenant context for groupId
    };
    await createFinanceRecord(payload);
    handleCreateClose();
    fetchRecords();
  };
  const handleEditSubmit = async (form: any) => {
    if (!editId) return;
    const payload = {
      ...form,
      secondPillar: Number(form.secondPillar),
      secondPillarGain: Number(form.secondPillarGain),
      thirdPillar: Number(form.thirdPillar),
      thirdPillarGain: Number(form.thirdPillarGain),
      etfPortfolio: Number(form.etfPortfolio),
      etfGain: Number(form.etfGain),
      cash: Number(form.cash),
      gold: Number(form.gold)
    };
    await updateFinanceRecord(editId, payload);
    handleEditClose();
    fetchRecords();
  };

  // Replace handleDelete with confirmation logic
  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) {
      await deleteFinanceRecord(deleteId);
      setDeleteConfirmOpen(false);
      setDeleteId(null);
      fetchRecords();
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeleteId(null);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Helper to calculate net worth for a record
  function calcNetWorth(record: any) {
    const sum = ['secondPillar', 'thirdPillar', 'etfPortfolio', 'cash', 'gold'].reduce(
      (sum, key) => sum + (Number(record[key]) || 0),
      0
    );
    return Math.round(sum * 100) / 100;
  }

  // Helper to calculate total gain for a record
  function calcGain(record: any) {
    const sum = ['secondPillarGain', 'thirdPillarGain', 'etfGain'].reduce(
      (sum, key) => sum + (Number(record[key]) || 0),
      0
    );
    return Math.round(sum * 100) / 100;
  }

  // Helper to format numbers with thousands separator and two decimals
  function formatNumber(value: number | string) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function sortRecords(base: any[]) {
    return [...base].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (sortBy === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortBy === 'netWorth') {
        aVal = calcNetWorth(a);
        bVal = calcNetWorth(b);
      } else if (sortBy === 'gain') {
        aVal = calcGain(a);
        bVal = calcGain(b);
      } else if (sortBy === 'change') {
        aVal = calcChange(a);
        bVal = calcChange(b);
      } else {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Helper to calculate change compared to previous record (sorted by date)
  function calcChange(record: any) {
    const recordsByDate = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentIndex = recordsByDate.findIndex(r => (r._id || r.id) === (record._id || record.id));
    
    if (currentIndex <= 0) return 0; // No previous record or first record
    
    const currentNetWorth = calcNetWorth(record);
    const previousNetWorth = calcNetWorth(recordsByDate[currentIndex - 1]);
    
    return Math.round((currentNetWorth - previousNetWorth) * 100) / 100;
  }

  // Filter records by date range
  const filteredRecords = useMemo(() => {
    if (!startDate && !endDate) return records;
    const startTs = startDate ? new Date(startDate).getTime() : -Infinity;
    const endTs = endDate ? new Date(endDate).getTime() + 24*60*60*1000 - 1 : Infinity; // inclusive end day
    return records.filter(r => {
      const ts = new Date(r.date).getTime();
      return !isNaN(ts) && ts >= startTs && ts <= endTs;
    });
  }, [records, startDate, endDate]);

  const displayRecords = useMemo(() => sortRecords(filteredRecords), [filteredRecords, sortBy, sortOrder]);

  // Summary computation (change across period)
  const summary = useMemo(() => {
    if (!displayRecords.length) return null;
    // sort ascending by date for period endpoints
    const byDateAsc = [...displayRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = byDateAsc[0];
    const last = byDateAsc[byDateAsc.length - 1];
    const firstNet = calcNetWorth(first);
    const lastNet = calcNetWorth(last);
    const diff = lastNet - firstNet;
    const pct = firstNet !== 0 ? (diff / firstNet) * 100 : 0;
    return { first, last, firstNet, lastNet, diff, pct };
  }, [displayRecords]);

  // Quick range handlers
  const applyQuickRange = (range: string) => {
    const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    let effectiveEnd = endDate;
    if (!effectiveEnd) {
      // Derive latest record date as baseline if endDate was cleared via reset
      const maxDate = records
        .map(r => new Date(r.date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (!maxDate) return; // no records
      effectiveEnd = iso(maxDate);
      setEndDate(effectiveEnd);
    }
    const start = new Date(effectiveEnd);
    if (range === '1M') start.setMonth(start.getMonth() - 1);
    else if (range === '6M') start.setMonth(start.getMonth() - 6);
    else if (range === '1Y') start.setFullYear(start.getFullYear() - 1);
    else if (range === '2Y') start.setFullYear(start.getFullYear() - 2);
    else if (range === '3Y') start.setFullYear(start.getFullYear() - 3);
  else if (range === 'YTD') { start.setMonth(0, 1); }
    setStartDate(iso(start));
    setQuickRange(range);
  };

  const clearQuickRange = () => setQuickRange('');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Finance Records
        </Typography>
        <Button variant="contained" startIcon={<Add />} sx={{ bgcolor: 'primary.main' }} onClick={handleCreateOpen}>
          Add Record
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          {/* Show current tenant context */}
          {tenantGroupId ? (
            <Typography variant="body2" color="primary">
              Showing records for selected group
            </Typography>
          ) : (
            <Typography variant="body2" color="primary">
              Showing personal records
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ position: 'relative' }}>
            <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>From</Box>
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); clearQuickRange(); }}
              style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
            />
          </Box>
          <Box sx={{ position: 'relative' }}>
            <Box component="span" sx={{ position: 'absolute', top: 4, left: 8, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', pointerEvents: 'none', textTransform: 'uppercase' }}>To</Box>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); }}
              style={{ padding: '20px 8px 6px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant={quickRange === '1M' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('1M')}>Last 1M</Button>
            <Button size="small" variant={quickRange === '6M' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('6M')}>Last 6M</Button>
            <Button size="small" variant={quickRange === 'YTD' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('YTD')}>YTD</Button>
            <Button size="small" variant={quickRange === '1Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('1Y')}>Last 1Y</Button>
            <Button size="small" variant={quickRange === '2Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('2Y')}>Last 2Y</Button>
            <Button size="small" variant={quickRange === '3Y' ? 'contained' : 'outlined'} onClick={() => applyQuickRange('3Y')}>Last 3Y</Button>
            <Button size="small" onClick={() => { setStartDate(''); setEndDate(''); clearQuickRange(); }} disabled={!startDate && !endDate}>Reset</Button>
          </Box>
          {quickRange && (
            <Typography variant="caption" color="text.secondary">Quick range active: {quickRange}</Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Showing {displayRecords.length} record{displayRecords.length === 1 ? '' : 's'}
          </Typography>
        </Box>
      </Paper>
      {/* Summary (moved to top) */}
      <Paper sx={{ mb: 2, p: 2 }} variant="outlined">
        {summary ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Net Worth Change {quickRange ? `(${quickRange})` : startDate || endDate ? ' (Filtered Period)' : ''}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              From <strong>{formatDate(summary.first.date)}</strong> at <strong>{formatNumber(summary.firstNet)}</strong> to <strong>{formatDate(summary.last.date)}</strong> at <strong>{formatNumber(summary.lastNet)}</strong>.
              {' '}Change: <strong style={{ color: summary.diff > 0 ? '#2e7d32' : summary.diff < 0 ? '#d32f2f' : undefined }}>
                {summary.diff > 0 ? '+' : ''}{formatNumber(summary.diff)} ({summary.diff > 0 ? '+' : ''}{summary.pct.toFixed(2)}%)
              </strong>
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2">No data in selected period.</Typography>
        )}
      </Paper>

      <FinanceRecordModal
        open={createOpen}
        onClose={handleCreateClose}
        onSubmit={handleCreateSubmit}
        form={createForm}
        setForm={setCreateForm}
        title="Add Finance Record"
      />
      <FinanceRecordModal
        open={editOpen}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        form={editForm}
        setForm={setEditForm}
        title="Edit Finance Record"
      />

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: 500,
              fontSize: { xs: '0.72rem', sm: '0.95rem' },
              '& th, & td': {
                px: { xs: 0.5, sm: 1 },
                py: { xs: 0.5, sm: 0.8 },
                fontSize: { xs: '0.72rem', sm: '0.95rem' },
                whiteSpace: { xs: 'nowrap', sm: 'normal' },
                maxWidth: { xs: 80, sm: 'none' },
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 60 }}>
                  <TableSortLabel
                    active={sortBy === 'date'}
                    direction={sortBy === 'date' ? sortOrder : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Date</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'secondPillar'}
                    direction={sortBy === 'secondPillar' ? sortOrder : 'asc'}
                    onClick={() => handleSort('secondPillar')}
                  >
                    <span style={{ fontSize: '0.78em' }}>2nd Pillar</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'secondPillarGain'}
                    direction={sortBy === 'secondPillarGain' ? sortOrder : 'asc'}
                    onClick={() => handleSort('secondPillarGain')}
                  >
                    <span style={{ fontSize: '0.78em' }}>2nd Pillar Gain</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'thirdPillar'}
                    direction={sortBy === 'thirdPillar' ? sortOrder : 'asc'}
                    onClick={() => handleSort('thirdPillar')}
                  >
                    <span style={{ fontSize: '0.78em' }}>3rd Pillar</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'thirdPillarGain'}
                    direction={sortBy === 'thirdPillarGain' ? sortOrder : 'asc'}
                    onClick={() => handleSort('thirdPillarGain')}
                  >
                    <span style={{ fontSize: '0.78em' }}>3rd Pillar Gain</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'etfPortfolio'}
                    direction={sortBy === 'etfPortfolio' ? sortOrder : 'asc'}
                    onClick={() => handleSort('etfPortfolio')}
                  >
                    <span style={{ fontSize: '0.78em' }}>ETF Portfolio</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'etfGain'}
                    direction={sortBy === 'etfGain' ? sortOrder : 'asc'}
                    onClick={() => handleSort('etfGain')}
                  >
                    <span style={{ fontSize: '0.78em' }}>ETF Gain</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'cash'}
                    direction={sortBy === 'cash' ? sortOrder : 'asc'}
                    onClick={() => handleSort('cash')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Cash</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'gold'}
                    direction={sortBy === 'gold' ? sortOrder : 'asc'}
                    onClick={() => handleSort('gold')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Gold</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 90 }}>
                  <TableSortLabel
                    active={sortBy === 'netWorth'}
                    direction={sortBy === 'netWorth' ? sortOrder : 'asc'}
                    onClick={() => handleSort('netWorth')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Total</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'gain'}
                    direction={sortBy === 'gain' ? sortOrder : 'asc'}
                    onClick={() => handleSort('gain')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Gain</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ minWidth: 80 }}>
                  <TableSortLabel
                    active={sortBy === 'change'}
                    direction={sortBy === 'change' ? sortOrder : 'asc'}
                    onClick={() => handleSort('change')}
                  >
                    <span style={{ fontSize: '0.78em' }}>Change</span>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ minWidth: 60 }}>
                  <span style={{ fontSize: '0.78em' }}>Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={13}>Loading...</TableCell>
                </TableRow>
              ) : displayRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13}>No records found.</TableCell>
                </TableRow>
              ) : (
                displayRecords.map((record: any) => {
                  const change = calcChange(record);
                  return (
                    <TableRow key={record._id || record.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell align="right">{formatNumber(record.secondPillar)}</TableCell>
                      <TableCell align="right">{formatNumber(record.secondPillarGain)}</TableCell>
                      <TableCell align="right">{formatNumber(record.thirdPillar)}</TableCell>
                      <TableCell align="right">{formatNumber(record.thirdPillarGain)}</TableCell>
                      <TableCell align="right">{formatNumber(record.etfPortfolio)}</TableCell>
                      <TableCell align="right">{formatNumber(record.etfGain)}</TableCell>
                      <TableCell align="right">{formatNumber(record.cash)}</TableCell>
                      <TableCell align="right">{formatNumber(record.gold)}</TableCell>
                      <TableCell align="right">{formatNumber(calcNetWorth(record))}</TableCell>
                      <TableCell align="right">{formatNumber(calcGain(record))}</TableCell>
                      <TableCell 
                        align="right" 
                        sx={{ 
                          color: change > 0 ? 'success.main' : change < 0 ? 'error.main' : 'inherit',
                          fontWeight: change !== 0 ? 'bold' : 'normal'
                        }}
                      >
                        {change === 0 ? '-' : (change > 0 ? '+' : '') + formatNumber(change)}
                      </TableCell>
                      <TableCell align="center">
                        <Button color="primary" size="small" onClick={() => handleEditOpen(record)}>
                          <EditIcon />
                        </Button>
                        <Button color="error" size="small" onClick={() => handleDeleteClick(record._id || record.id)}>
                          <DeleteIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <ConfirmationModal
        open={deleteConfirmOpen}
        title="Delete Record"
        message="Are you sure you want to delete this record?"
        confirmText="Delete"
        cancelText="Cancel"
        severity="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};

export default FinancialRecords;
