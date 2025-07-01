import React, { useEffect, useState } from 'react';
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
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { getFinanceRecords, createFinanceRecord, deleteFinanceRecord, updateFinanceRecord } from '../services/financeRecordService';
import FinanceRecordModal from '../components/FinanceRecordModal';

const FinancialRecords: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    date: '', secondPillar: '', secondPillarGain: '', thirdPillar: '', thirdPillarGain: '', etfPortfolio: '', etfGain: '', cash: '', gold: ''
  });
  const [editForm, setEditForm] = useState({
    date: '', secondPillar: '', secondPillarGain: '', thirdPillar: '', thirdPillarGain: '', etfPortfolio: '', etfGain: '', cash: '', gold: ''
  });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await getFinanceRecords();
      setRecords(data);
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
    setCreateForm({ date: toLocalInputDate(new Date()), secondPillar: '', secondPillarGain: '', thirdPillar: '', thirdPillarGain: '', etfPortfolio: '', etfGain: '', cash: '', gold: '' });
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
      gold: Number(form.gold)
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
    const sum = [
      'secondPillar',
      'thirdPillar',
      'etfPortfolio',
      'cash',
      'gold'
    ].reduce((sum, key) => sum + (Number(record[key]) || 0), 0);
    return Math.round(sum * 100) / 100;
  }

  // Helper to calculate total gain for a record
  function calcGain(record: any) {
    const sum = [
      'secondPillarGain',
      'thirdPillarGain',
      'etfGain'
    ].reduce((sum, key) => sum + (Number(record[key]) || 0), 0);
    return Math.round(sum * 100) / 100;
  }

  // Helper to format numbers with thousands separator and two decimals
  function formatNumber(value: number | string) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sortedRecords() {
    return [...records].sort((a, b) => {
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
      } else {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Finance Records
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: 'primary.main' }}
          onClick={handleCreateOpen}
        >
          Add Record
        </Button>
      </Box>

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
                textOverflow: 'ellipsis',
              },
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
                <TableCell align="center" sx={{ minWidth: 60 }}>
                  <span style={{ fontSize: '0.78em' }}>Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12}>Loading...</TableCell></TableRow>
              ) : sortedRecords().length === 0 ? (
                <TableRow><TableCell colSpan={12}>No records found.</TableCell></TableRow>
              ) : (
                sortedRecords().map((record: any) => (
                  <TableRow
                    key={record._id || record.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
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
                    <TableCell align="center">
                      <Button color="primary" size="small" onClick={() => handleEditOpen(record)}>
                        <EditIcon />
                      </Button>
                      <Button color="error" size="small" onClick={() => handleDeleteClick(record._id || record.id)}>
                        <DeleteIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Record</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this record? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FinancialRecords;
