import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Collapse,
  Typography,
  Button
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { AssetAllocation, AssetClass } from '../../types';

interface AssetAllocationTableProps {
  loading: boolean;
  sortedGroupedAllocations: any[];
  chronoSortedAllocations: any[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (column: string) => void;
  expandedRows: Set<string>;
  handleRowExpand: (dateKey: string) => void;
  handleEditOpen: (allocation: AssetAllocation) => void;
  handleDeleteClick: (id: string) => void;
  assetClasses: AssetClass[];
}

const AssetAllocationTable: React.FC<AssetAllocationTableProps> = ({
  loading,
  sortedGroupedAllocations,
  chronoSortedAllocations,
  sortBy,
  sortOrder,
  handleSort,
  expandedRows,
  handleRowExpand,
  handleEditOpen,
  handleDeleteClick,
  assetClasses
}) => {
  // Helper to format date for table display (DD.MM.YYYY)
  function formatDate(date: string | Date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Helper to format numbers with thousands separator and two decimals
  function formatNumber(value: number | string) {
    if (value === null || value === undefined || value === '') return '';
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Helper to get asset class name
  function getAssetClassName(allocation: AssetAllocation): string {
    if (typeof allocation.assetClassId === 'string') {
      const assetClass = assetClasses.find((ac: AssetClass) => ac._id === allocation.assetClassId);
      return assetClass?.name || 'Unknown';
    }
    return allocation.assetClassId.name;
  }

  // Helper to get date key (YYYY-MM-DD) ignoring time
  function getDateKey(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10); // YYYY-MM-DD format
  }

  return (
    <Paper elevation={0} sx={{ width: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <TableContainer
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          '&::-webkit-scrollbar': {
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            minWidth: { xs: 340, sm: 500, md: 600, lg: 700 },
            width: '100%',
            fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
            '& th, & td': {
              px: { xs: 0.125, sm: 0.5, md: 1, lg: 1.5 },
              py: { xs: 0.375, sm: 0.75, md: 0.875, lg: 1 },
              fontSize: { xs: '0.68rem', sm: '0.875rem', md: '0.9375rem', lg: '1rem' },
              whiteSpace: { xs: 'nowrap', sm: 'normal' },
              maxWidth: { xs: 60, sm: 'none' },
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ minWidth: { xs: 30, sm: 45, md: 50 }, width: { xs: 30, sm: 45, md: 50 } }}>
                <span style={{ fontSize: '0.78em' }}></span>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: { xs: 40, sm: 75, md: 85, lg: 95 }, width: { xs: 50, sm: 75, md: 85, lg: 95 } }}>
                <TableSortLabel
                  active={sortBy === 'date'}
                  direction={sortBy === 'date' ? sortOrder : 'asc'}
                  onClick={() => handleSort('date')}
                >
                  <span style={{ fontSize: '0.78em' }}>Date</span>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                <TableSortLabel
                  active={sortBy === 'totalValue'}
                  direction={sortBy === 'totalValue' ? sortOrder : 'asc'}
                  onClick={() => handleSort('totalValue')}
                >
                  <span style={{ fontSize: '0.78em' }}>Total Value</span>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                <TableSortLabel
                  active={sortBy === 'totalGain'}
                  direction={sortBy === 'totalGain' ? sortOrder : 'asc'}
                  onClick={() => handleSort('totalGain')}
                >
                  <span style={{ fontSize: '0.78em' }}>Gain</span>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: { xs: 45, sm: 90, md: 105, lg: 120 }, width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                <TableSortLabel
                  active={sortBy === 'change'}
                  direction={sortBy === 'change' ? sortOrder : 'asc'}
                  onClick={() => handleSort('change')}
                >
                  <span style={{ fontSize: '0.78em' }}>Change</span>
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            ) : sortedGroupedAllocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No asset allocations found.</TableCell>
              </TableRow>
            ) : (
              sortedGroupedAllocations.map((group) => {
                const dateKey = getDateKey(group.date);
                const isExpanded = expandedRows.has(dateKey);
                
                // Calculate change from previous chronological allocation
                const chronoIndex = chronoSortedAllocations.findIndex(item => item.date.getTime() === group.date.getTime());
                const prevChronoGroup = chronoIndex > 0 ? chronoSortedAllocations[chronoIndex - 1] : null;
                const change = prevChronoGroup ? group.totalValue - prevChronoGroup.totalValue : null;
                
                return (
                  <React.Fragment key={dateKey}>
                    {/* Main row with totals */}
                    <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ width: { xs: 30, sm: 45, md: 50 } }}>
                        <IconButton
                          size="small"
                          onClick={() => handleRowExpand(dateKey)}
                          sx={{ p: { xs: 0.125, sm: 0.5 } }}
                        >
                          {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                      </TableCell>
                      <TableCell align="center" sx={{ width: { xs: 50, sm: 75, md: 85, lg: 95 } }}>
                        {formatDate(group.date)}
                      </TableCell>
                      <TableCell align="right" sx={{ width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                        {formatNumber(group.totalValue)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: group.totalGain >= 0 ? 'success.main' : 'error.main', width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                        {formatNumber(group.totalGain)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: change !== null && change >= 0 ? 'success.main' : change !== null && change < 0 ? 'error.main' : 'text.secondary', width: { xs: 65, sm: 90, md: 105, lg: 120 } }}>
                        {change !== null ? (change >= 0 ? '+' : '') + formatNumber(change) : '-'}
                      </TableCell>
                    </TableRow>

                    {/* Expandable row with individual allocations */}
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' } }}>
                              Individual Allocations:
                            </Typography>
                            <Table size="small" sx={{ minWidth: { xs: 280, sm: 400, md: 'auto' } }}>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 70, sm: 90, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Asset Class</TableCell>
                                  <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 50, sm: 70, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Value</TableCell>
                                  <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 40, sm: 60, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Gain</TableCell>
                                  <TableCell align="center" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, minWidth: { xs: 50, sm: 70, md: 'auto' }, px: { xs: 0.5, sm: 1 } }}>Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[...group.allocations].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0)).map((allocation: AssetAllocation) => (
                                  <TableRow key={allocation._id} sx={{ backgroundColor: 'grey.50' }}>
                                    <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                      {getAssetClassName(allocation)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                      {formatNumber(allocation.totalValue)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 }, color: (allocation.gain || 0) >= 0 ? 'success.main' : 'error.main' }}>
                                      {formatNumber(allocation.gain)}
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontSize: { xs: '0.7rem', sm: '0.8125rem', md: '0.875rem' }, py: 0.5, px: { xs: 0.5, sm: 1 } }}>
                                      <Box sx={{ display: 'flex', gap: { xs: 0.125, sm: 0.5 }, justifyContent: 'center' }}>
                                        <Button color="primary" size="small" onClick={() => handleEditOpen(allocation)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                                          <EditIcon fontSize="small" />
                                        </Button>
                                        <Button color="error" size="small" onClick={() => handleDeleteClick(allocation._id)} sx={{ minWidth: 'auto', p: { xs: 0.25, sm: 0.5 } }}>
                                          <DeleteIcon fontSize="small" />
                                        </Button>
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AssetAllocationTable;
