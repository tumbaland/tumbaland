import React from 'react';
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
  Chip,
  Button
} from '@mui/material';
import { Add } from '@mui/icons-material';

const Transactions: React.FC = () => {
  // Mock transaction data
  const transactions = [
    {
      id: 1,
      date: '2025-06-20',
      type: 'BUY',
      asset: 'AAPL',
      quantity: 10,
      price: 150.00,
      total: 1500.00
    },
    {
      id: 2,
      date: '2025-06-19',
      type: 'SELL',
      asset: 'GOOGL',
      quantity: 5,
      price: 2800.00,
      total: 14000.00
    },
    {
      id: 3,
      date: '2025-06-18',
      type: 'BUY',
      asset: 'MSFT',
      quantity: 15,
      price: 420.00,
      total: 6300.00
    }
  ];

  const getTypeColor = (type: string) => {
    return type === 'BUY' ? 'success' : 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Transactions
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: 'primary.main' }}
        >
          Add Transaction
        </Button>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow
                  key={transaction.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.type}
                      color={getTypeColor(transaction.type) as 'success' | 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{transaction.asset}</TableCell>
                  <TableCell align="right">{transaction.quantity}</TableCell>
                  <TableCell align="right">${transaction.price.toFixed(2)}</TableCell>
                  <TableCell align="right">${transaction.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>      </Paper>
    </Box>
  );
};

export default Transactions;
