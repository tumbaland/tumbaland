import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface PriceHistoryRow {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

interface TickerHistoryTableProps {
  rows: PriceHistoryRow[];
  onDeleteRow?: (row: PriceHistoryRow) => void;
}

const TickerHistoryTable: React.FC<TickerHistoryTableProps> = ({ rows, onDeleteRow }) => {
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
        Price History
      </Typography>
      <TableContainer sx={{ 
        maxHeight: 240, 
        borderRadius: 3, 
        border: '1px solid',
        borderColor: 'divider',
        overflowX: 'auto' 
      }}>
        <Table size="small" stickyHeader aria-label="price history table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>
                Open
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>
                High
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>
                Low
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>
                Close
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 } }}>
                Volume
              </TableCell>
              <TableCell align="center" sx={{ width: 40 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              // Format date as DD.MM.YYYY
              const d = new Date(row.date);
              const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
              return (
                <TableRow key={row.date} hover>
                  <TableCell sx={{ fontSize: { xs: 12, sm: 14 }, whiteSpace: 'nowrap' }}>{dateStr}</TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                    {row.open !== undefined ? row.open.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                    {row.high !== undefined ? row.high.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                    {row.low !== undefined ? row.low.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                    {row.close.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                    {row.volume !== undefined ? row.volume.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      aria-label="delete"
                      size="small"
                      color="error"
                      onClick={
                        onDeleteRow
                          ? (e) => {
                              e.stopPropagation();
                              onDeleteRow(row);
                            }
                          : undefined
                      }
                      disabled={!onDeleteRow}
                      tabIndex={0}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TickerHistoryTable;
